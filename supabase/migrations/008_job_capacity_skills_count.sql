-- Add capacity, required_skills, and trigger-maintained applicant_count to jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS capacity INTEGER NOT NULL DEFAULT 1;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS required_skills TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS applicant_count INTEGER NOT NULL DEFAULT 0;

-- Backfill applicant_count for existing rows
UPDATE jobs j
SET applicant_count = (
  SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id
);

-- Trigger function: keep applicant_count in sync
CREATE OR REPLACE FUNCTION update_job_applicant_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE jobs SET applicant_count = applicant_count + 1 WHERE id = NEW.job_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE jobs SET applicant_count = GREATEST(0, applicant_count - 1) WHERE id = OLD.job_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_job_applicant_count ON applications;
CREATE TRIGGER trigger_update_job_applicant_count
  AFTER INSERT OR DELETE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_job_applicant_count();
