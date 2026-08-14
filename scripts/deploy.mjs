import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const sourceConfig = "wrangler.jsonc";
const deployConfig = "wrangler.deploy.jsonc";
const workerName = "tg-blogpost";

function runWrangler(args, options = {}) {
  return execFileSync("npx", ["--yes", "wrangler", ...args], {
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
    cwd: options.cwd,
  });
}

function parseJsonc(text) {
  return JSON.parse(
    text
      .replace(/\/\/.*$/gm, "")
      .replace(/,\s*([}\]])/g, "$1"),
  );
}

function resolveDashboardConfig() {
  const tempDir = mkdtempSync(join(tmpdir(), "tg-blogpost-dash-"));
  try {
    console.log(`Fetching ${workerName} configuration from Cloudflare dashboard...`);
    runWrangler(["init", ".", "--from-dash", workerName, "--yes"], {
      cwd: tempDir,
    });

    const candidates = ["wrangler.jsonc", "wrangler.json", "wrangler.toml"];
    const configName = candidates.find((name) => existsSync(join(tempDir, name)));
    if (!configName) {
      throw new Error("Cloudflare dashboard configuration was not generated.");
    }

    if (configName.endsWith(".toml")) {
      throw new Error("Cloudflare returned TOML config; expected JSON/JSONC.");
    }

    return parseJsonc(readFileSync(join(tempDir, configName), "utf8"));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

try {
  const source = parseJsonc(readFileSync(sourceConfig, "utf8"));
  const dashboard = resolveDashboardConfig();
  const dashboardD1 = Array.isArray(dashboard.d1_databases)
    ? dashboard.d1_databases.find((db) => db?.binding === "DB")
    : null;

  if (!dashboardD1?.database_id) {
    throw new Error("Cloudflare dashboard config does not contain a valid DB D1 binding.");
  }

  console.log(`Using dashboard D1 binding: ${dashboardD1.database_name} (${dashboardD1.database_id})`);

  const merged = {
    ...source,
    d1_databases: [
      {
        binding: "DB",
        database_name: dashboardD1.database_name,
        database_id: dashboardD1.database_id,
        ...(dashboardD1.preview_database_id
          ? { preview_database_id: dashboardD1.preview_database_id }
          : {}),
        ...(source.d1_databases?.[0]?.migrations_dir
          ? { migrations_dir: source.d1_databases[0].migrations_dir }
          : {}),
      },
    ],
  };

  writeFileSync(deployConfig, JSON.stringify(merged, null, 2), "utf8");
  console.log(`Deploying with ${deployConfig}...`);

  execFileSync("npx", ["--yes", "wrangler", "deploy", "--config", deployConfig, "--keep-vars"], {
    stdio: "inherit",
  });
} finally {
  if (existsSync(deployConfig)) rmSync(deployConfig, { force: true });
}
