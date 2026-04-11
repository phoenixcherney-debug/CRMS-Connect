-- Add location_type and industry to jobs
-- location_type: remote, in-person, hybrid
-- industry: free-text matching INDUSTRY_OPTIONS in the frontend

CREATE TYPE location_type_enum AS ENUM ('remote', 'in-person', 'hybrid');

ALTER TABLE jobs
  ADD COLUMN location_type location_type_enum NOT NULL DEFAULT 'in-person',
  ADD COLUMN industry      TEXT;
