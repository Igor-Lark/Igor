CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS websites (
  id TEXT PRIMARY KEY,
  host TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  positioning TEXT NOT NULL DEFAULT '',
  content_rules TEXT NOT NULL DEFAULT '',
  seo_rules TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS service_directions (
  id TEXT PRIMARY KEY,
  website_id TEXT NOT NULL REFERENCES websites(id),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  website_id TEXT NOT NULL REFERENCES websites(id),
  direction_id TEXT REFERENCES service_directions(id),
  url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS page_snapshots (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES pages(id),
  fetched_at TEXT NOT NULL,
  http_status INTEGER,
  final_url TEXT,
  title_tag TEXT NOT NULL DEFAULT '',
  meta_description TEXT NOT NULL DEFAULT '',
  h1 TEXT NOT NULL DEFAULT '',
  headings_json TEXT NOT NULL DEFAULT '[]',
  text_content TEXT NOT NULL DEFAULT '',
  links_json TEXT NOT NULL DEFAULT '[]',
  published_at TEXT,
  incomplete INTEGER NOT NULL DEFAULT 0,
  warnings_json TEXT NOT NULL DEFAULT '[]',
  html_path TEXT
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  direction_id TEXT REFERENCES service_directions(id),
  page_id TEXT REFERENCES pages(id),
  parent_task_id TEXT REFERENCES tasks(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  input_json TEXT NOT NULL DEFAULT '{}',
  progress INTEGER NOT NULL DEFAULT 0,
  progress_label TEXT NOT NULL DEFAULT '',
  partial_result_json TEXT,
  result_json TEXT,
  error_message TEXT,
  warnings_json TEXT NOT NULL DEFAULT '[]',
  needs_review INTEGER NOT NULL DEFAULT 0,
  control TEXT,
  scheduled_for TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status, created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_direction ON tasks(direction_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type, updated_at);

CREATE TABLE IF NOT EXISTS task_events (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  at TEXT NOT NULL,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  data_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_task_events_task ON task_events(task_id, at);

CREATE TABLE IF NOT EXISTS task_comments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  at TEXT NOT NULL,
  body TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT,
  publisher TEXT,
  published_at TEXT,
  accessed_at TEXT NOT NULL,
  source_type TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  reliability TEXT NOT NULL DEFAULT 'unknown',
  reliability_note TEXT NOT NULL DEFAULT '',
  review_status TEXT NOT NULL DEFAULT 'unreviewed',
  unavailable INTEGER NOT NULL DEFAULT 0,
  excerpt TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS source_directions (
  source_id TEXT NOT NULL REFERENCES sources(id),
  direction_id TEXT NOT NULL REFERENCES service_directions(id),
  PRIMARY KEY (source_id, direction_id)
);

CREATE TABLE IF NOT EXISTS source_pages (
  source_id TEXT NOT NULL REFERENCES sources(id),
  page_id TEXT NOT NULL REFERENCES pages(id),
  PRIMARY KEY (source_id, page_id)
);

CREATE TABLE IF NOT EXISTS task_sources (
  task_id TEXT NOT NULL REFERENCES tasks(id),
  source_id TEXT NOT NULL REFERENCES sources(id),
  PRIMARY KEY (task_id, source_id)
);

CREATE TABLE IF NOT EXISTS research_reports (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  direction_id TEXT REFERENCES service_directions(id),
  page_id TEXT REFERENCES pages(id),
  previous_report_id TEXT REFERENCES research_reports(id),
  goal TEXT NOT NULL,
  conducted_at TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  confirmed_facts_json TEXT NOT NULL DEFAULT '[]',
  contradictions_json TEXT NOT NULL DEFAULT '[]',
  uncertainties_json TEXT NOT NULL DEFAULT '[]',
  recommendations_json TEXT NOT NULL DEFAULT '[]',
  application_notes TEXT NOT NULL DEFAULT '',
  changes_vs_previous TEXT NOT NULL DEFAULT '',
  synthesis_mode TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_direction ON research_reports(direction_id, conducted_at);

CREATE TABLE IF NOT EXISTS research_findings (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES research_reports(id),
  kind TEXT NOT NULL,
  statement TEXT NOT NULL,
  is_hypothesis INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS finding_sources (
  finding_id TEXT NOT NULL REFERENCES research_findings(id),
  source_id TEXT NOT NULL REFERENCES sources(id),
  PRIMARY KEY (finding_id, source_id)
);

CREATE TABLE IF NOT EXISTS report_sources (
  report_id TEXT NOT NULL REFERENCES research_reports(id),
  source_id TEXT NOT NULL REFERENCES sources(id),
  PRIMARY KEY (report_id, source_id)
);

CREATE TABLE IF NOT EXISTS user_observations (
  id TEXT PRIMARY KEY,
  direction_id TEXT REFERENCES service_directions(id),
  page_id TEXT REFERENCES pages(id),
  observed_on TEXT NOT NULL,
  period_label TEXT NOT NULL DEFAULT '',
  author_label TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS content_versions (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES pages(id),
  direction_id TEXT REFERENCES service_directions(id),
  task_id TEXT REFERENCES tasks(id),
  parent_version_id TEXT REFERENCES content_versions(id),
  kind TEXT NOT NULL,
  origin TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  title_tag TEXT NOT NULL DEFAULT '',
  meta_description TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  change_explanation TEXT NOT NULL DEFAULT '',
  sources_json TEXT NOT NULL DEFAULT '[]',
  approval_status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_content_page ON content_versions(page_id, created_at);

CREATE TABLE IF NOT EXISTS seo_analyses (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES pages(id),
  direction_id TEXT REFERENCES service_directions(id),
  task_id TEXT REFERENCES tasks(id),
  snapshot_id TEXT REFERENCES page_snapshots(id),
  conducted_at TEXT NOT NULL,
  preliminary INTEGER NOT NULL DEFAULT 1,
  findings_json TEXT NOT NULL,
  queries_json TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '',
  llm_notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS advertising_concepts (
  id TEXT PRIMARY KEY,
  direction_id TEXT NOT NULL REFERENCES service_directions(id),
  page_id TEXT REFERENCES pages(id),
  task_id TEXT REFERENCES tasks(id),
  name TEXT NOT NULL,
  goal TEXT NOT NULL DEFAULT '',
  audience TEXT NOT NULL DEFAULT '',
  season_label TEXT NOT NULL DEFAULT '',
  offer TEXT NOT NULL DEFAULT '',
  hypothesis TEXT NOT NULL DEFAULT '',
  key_argument TEXT NOT NULL DEFAULT '',
  format TEXT NOT NULL DEFAULT '',
  constraints TEXT NOT NULL DEFAULT '',
  visual_notes TEXT NOT NULL DEFAULT '',
  approval_status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ad_copy_versions (
  id TEXT PRIMARY KEY,
  concept_id TEXT NOT NULL REFERENCES advertising_concepts(id),
  task_id TEXT REFERENCES tasks(id),
  parent_version_id TEXT REFERENCES ad_copy_versions(id),
  headlines_json TEXT NOT NULL DEFAULT '[]',
  extra_headlines_json TEXT NOT NULL DEFAULT '[]',
  texts_json TEXT NOT NULL DEFAULT '[]',
  short_variants_json TEXT NOT NULL DEFAULT '[]',
  ctas_json TEXT NOT NULL DEFAULT '[]',
  idea TEXT NOT NULL DEFAULT '',
  hypotheses_json TEXT NOT NULL DEFAULT '[]',
  warnings_json TEXT NOT NULL DEFAULT '[]',
  approval_status TEXT NOT NULL DEFAULT 'draft',
  origin TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS image_prompts (
  id TEXT PRIMARY KEY,
  direction_id TEXT NOT NULL REFERENCES service_directions(id),
  concept_id TEXT REFERENCES advertising_concepts(id),
  page_id TEXT REFERENCES pages(id),
  task_id TEXT REFERENCES tasks(id),
  name TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT '',
  target_format TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  composition TEXT NOT NULL DEFAULT '',
  angle TEXT NOT NULL DEFAULT '',
  environment TEXT NOT NULL DEFAULT '',
  lighting TEXT NOT NULL DEFAULT '',
  weather TEXT NOT NULL DEFAULT '',
  season TEXT NOT NULL DEFAULT '',
  text_space TEXT NOT NULL DEFAULT '',
  realism TEXT NOT NULL DEFAULT '',
  constraints TEXT NOT NULL DEFAULT '',
  reference_note TEXT NOT NULL DEFAULT '',
  prompt_text TEXT NOT NULL,
  origin TEXT NOT NULL,
  approval_status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS creative_assets (
  id TEXT PRIMARY KEY,
  direction_id TEXT REFERENCES service_directions(id),
  concept_id TEXT REFERENCES advertising_concepts(id),
  page_id TEXT REFERENCES pages(id),
  name TEXT NOT NULL,
  format_label TEXT NOT NULL DEFAULT '',
  mime TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  storage_path TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  user_comment TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS creative_reviews (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES creative_assets(id),
  task_id TEXT REFERENCES tasks(id),
  conducted_at TEXT NOT NULL,
  mode TEXT NOT NULL,
  criteria_json TEXT NOT NULL DEFAULT '[]',
  overall_note TEXT NOT NULL DEFAULT '',
  strengths_json TEXT NOT NULL DEFAULT '[]',
  weaknesses_json TEXT NOT NULL DEFAULT '[]',
  critical_json TEXT NOT NULL DEFAULT '[]',
  recommendations_json TEXT NOT NULL DEFAULT '[]',
  recheck_recommended INTEGER NOT NULL DEFAULT 0,
  unavailable_reason TEXT,
  disclaimer TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS approval_events (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_approvals_target ON approval_events(target_type, target_id, at);

CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  message TEXT NOT NULL,
  direction_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_activity_at ON activity_log(at);

CREATE TABLE IF NOT EXISTS commercial_facts (
  id TEXT PRIMARY KEY,
  direction_id TEXT REFERENCES service_directions(id),
  page_id TEXT REFERENCES pages(id),
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  value TEXT NOT NULL,
  source_note TEXT NOT NULL,
  source_url TEXT,
  confirmed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_notes (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  direction_id TEXT REFERENCES service_directions(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  source_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
