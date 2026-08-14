import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";

const sourceConfig = "wrangler.jsonc";
const deployConfig = "wrangler.deploy.jsonc";
const dbName = "tg-blogpost-db";

function runWrangler(args) {
  return execFileSync("npx", ["--yes", "wrangler", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function extractDatabaseId(output) {
  const parsed = JSON.parse(output);
  if (Array.isArray(parsed)) {
    const db = parsed.find((item) => item?.name === dbName || item?.database_name === dbName);
    return db?.uuid ?? db?.database_id ?? null;
  }
  return parsed?.uuid ?? parsed?.database_id ?? parsed?.database?.uuid ?? parsed?.database?.database_id ?? null;
}

try {
  console.log(`Resolving D1 database ID for ${dbName}...`);
  const info = runWrangler(["d1", "info", dbName, "--json"]);
  const databaseId = extractDatabaseId(info);

  if (!databaseId) {
    throw new Error(`Could not resolve a database ID for ${dbName}.`);
  }

  console.log(`Resolved D1 database: ${databaseId}`);

  const source = readFileSync(sourceConfig, "utf8");
  const updated = source.replace(
    /("database_name"\s*:\s*"tg-blogpost-db"\s*,\s*"database_id"\s*:\s*")[^"]+("\s*)/s,
    `$1${databaseId}$2`,
  );

  if (updated === source) {
    throw new Error("Could not locate the tg-blogpost-db database binding in wrangler.jsonc.");
  }

  writeFileSync(deployConfig, updated, "utf8");
  console.log(`Deploying with resolved D1 binding from ${deployConfig}...`);

  execFileSync("npx", ["--yes", "wrangler", "deploy", "--config", deployConfig], {
    stdio: "inherit",
  });
} finally {
  if (existsSync(deployConfig)) unlinkSync(deployConfig);
}
