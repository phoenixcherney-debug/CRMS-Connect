-- Allow employers to pin applicants within their job's application list
ALTER TABLE applications ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE;
