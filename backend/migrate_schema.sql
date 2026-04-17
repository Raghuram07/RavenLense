-- RavenLens schema migration
-- Run once against your PostgreSQL database.

-- 1. projects: replace client string with client_id FK
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_id VARCHAR REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE projects DROP COLUMN IF EXISTS client;

-- 2. employees: remove project column
ALTER TABLE employees DROP COLUMN IF EXISTS project;

-- 3. project_members: add client_contact_id, drop name/email
ALTER TABLE project_members ADD COLUMN IF NOT EXISTS client_contact_id VARCHAR REFERENCES client_contacts(id) ON DELETE SET NULL;
ALTER TABLE project_members DROP COLUMN IF EXISTS name;
ALTER TABLE project_members DROP COLUMN IF EXISTS email;
CREATE INDEX IF NOT EXISTS idx_project_members_project  ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_employee ON project_members(employee_id);
CREATE INDEX IF NOT EXISTS idx_project_members_contact  ON project_members(client_contact_id);

-- 4. meetings: move heavy fields out
CREATE TABLE IF NOT EXISTS meeting_transcripts (
    id             VARCHAR PRIMARY KEY,
    meeting_id     VARCHAR NOT NULL UNIQUE REFERENCES meetings(id) ON DELETE CASCADE,
    raw_vtt        TEXT,
    raw_transcript TEXT
);

CREATE TABLE IF NOT EXISTS meeting_ai_outputs (
    id         VARCHAR PRIMARY KEY,
    meeting_id VARCHAR NOT NULL UNIQUE REFERENCES meetings(id) ON DELETE CASCADE,
    attendees  JSONB,
    decisions  JSONB,
    blockers   JSONB,
    summary    TEXT,
    full_mom   TEXT
);

CREATE TABLE IF NOT EXISTS meeting_action_items (
    id         VARCHAR PRIMARY KEY,
    meeting_id VARCHAR NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    owner      VARCHAR(200),
    task       TEXT NOT NULL,
    due_date   VARCHAR(50),
    status     VARCHAR(20) NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_action_items_meeting ON meeting_action_items(meeting_id);

-- Migrate existing meeting data to new tables
INSERT INTO meeting_transcripts (id, meeting_id, raw_vtt, raw_transcript)
SELECT gen_random_uuid()::text, id, raw_vtt, raw_transcript
FROM meetings
WHERE (raw_vtt IS NOT NULL OR raw_transcript IS NOT NULL)
ON CONFLICT DO NOTHING;

INSERT INTO meeting_ai_outputs (id, meeting_id, attendees, decisions, blockers, summary, full_mom)
SELECT gen_random_uuid()::text, id,
       attendees::jsonb, decisions::jsonb, blockers::jsonb,
       summary, full_mom
FROM meetings
WHERE (summary IS NOT NULL OR full_mom IS NOT NULL OR attendees IS NOT NULL)
ON CONFLICT DO NOTHING;

INSERT INTO meeting_action_items (id, meeting_id, owner, task, due_date)
SELECT gen_random_uuid()::text, m.id,
       item->>'owner', item->>'task', item->>'due'
FROM meetings m,
     jsonb_array_elements(m.action_items::jsonb) AS item
WHERE m.action_items IS NOT NULL AND m.action_items::text != 'null'
ON CONFLICT DO NOTHING;

-- Drop migrated columns from meetings
ALTER TABLE meetings DROP COLUMN IF EXISTS raw_vtt;
ALTER TABLE meetings DROP COLUMN IF EXISTS raw_transcript;
ALTER TABLE meetings DROP COLUMN IF EXISTS attendees;
ALTER TABLE meetings DROP COLUMN IF EXISTS decisions;
ALTER TABLE meetings DROP COLUMN IF EXISTS action_items;
ALTER TABLE meetings DROP COLUMN IF EXISTS blockers;
ALTER TABLE meetings DROP COLUMN IF EXISTS summary;
ALTER TABLE meetings DROP COLUMN IF EXISTS full_mom;
CREATE INDEX IF NOT EXISTS idx_meetings_project ON meetings(project_id);

-- 5. knowledge_files: remove file_data
ALTER TABLE knowledge_files DROP COLUMN IF EXISTS file_data;
CREATE INDEX IF NOT EXISTS idx_knowledge_files_project ON knowledge_files(project_id);

-- 6. activity_log table
CREATE TABLE IF NOT EXISTS activity_log (
    id          VARCHAR PRIMARY KEY,
    project_id  VARCHAR REFERENCES projects(id) ON DELETE SET NULL,
    entity_type VARCHAR(50),
    entity_id   VARCHAR,
    action_type VARCHAR(50),
    extra       JSONB,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activity_log_project ON activity_log(project_id);
