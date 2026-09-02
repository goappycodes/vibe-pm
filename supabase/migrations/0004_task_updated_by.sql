-- Migration: tasks.updated_by (last editor)
-- Names the last person to change a task; Slack change notices use it.
-- Additive and idempotent. Apply with:
--   node --env-file=.env.local scripts/apply-migration.mjs supabase/migrations/0004_task_updated_by.sql

alter table tasks
  add column if not exists updated_by text
    references team_members(id) on delete set null;
