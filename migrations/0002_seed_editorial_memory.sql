INSERT OR REPLACE INTO style_rules(key,value,confidence,source,updated_at) VALUES
('language','Uzbek Latin script; natural Uzbek conversational syntax',1.0,'manual-style-analysis',datetime('now')),
('emoji_policy','Do not use emojis by default; only when genuinely natural',1.0,'manual-style-analysis',datetime('now')),
('hashtag_policy','Never add hashtags to normal blog posts',1.0,'manual-style-analysis',datetime('now')),
('rubric_policy','Do not print rubric/category labels inside the post',1.0,'manual-style-analysis',datetime('now')),
('punctuation_va','Do not import English comma conventions before the Uzbek conjunction "va"',1.0,'manual-style-analysis',datetime('now')),
('dash_policy','Avoid em dashes and stylistic hyphens; use ordinary Uzbek sentence flow',1.0,'manual-style-analysis',datetime('now')),
('voice','Personal, observant, thoughtful, conversational and genuinely human',1.0,'manual-style-analysis',datetime('now')),
('intellectual_level','Do not explain obvious beginner ideas; seek a non-obvious angle',1.0,'manual-style-analysis',datetime('now')),
('originality','Never copy or paraphrase a ready-made internet or Telegram post',1.0,'manual-style-analysis',datetime('now')),
('topic_scope','Blog is broad; AI/IT is only one part of the authors worldview',1.0,'manual-style-analysis',datetime('now')),
('posting_frequency','Irregular 2-4 posts in a typical week; no fixed recurring schedule',0.9,'manual-style-analysis',datetime('now')),
('image_policy','Images are optional and disabled in the core pipeline',1.0,'manual-style-analysis',datetime('now')),
('ending_policy','Do not force a moral, motivational ending or question',1.0,'manual-style-analysis',datetime('now')),
('quality_policy','No post is better than a weak or filler post',1.0,'manual-style-analysis',datetime('now'));

INSERT OR REPLACE INTO settings(key,value,updated_at) VALUES
('min_qa_score','85',datetime('now')),
('image_generation_enabled','false',datetime('now')),
('max_revisions','3',datetime('now')),
('approval_required','true',datetime('now')),
('approval_lead_minutes','20',datetime('now'));
