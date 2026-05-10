-- 056_company_meta.sql
-- P1-6 (lightweight) — keyed-by-name metadata for the company strings on
-- jobs.company. Lets posters add a logo, website, location, and short
-- description without us promoting "company" to a first-class entity.
--
-- Trade-off: there's no notion of ownership. Anyone who has posted under
-- this company name can edit the meta row; whoever edits last wins. If the
-- product later wants claim-flow + per-poster permissions, this row
-- structure is forward-compatible (add a `claimed_by` column).

CREATE TABLE IF NOT EXISTS public.company_meta (
  -- Lower-cased canonical key. We always read/write this from the client.
  name_key      TEXT         PRIMARY KEY,
  -- Display name (preserves the casing the first poster used).
  display_name  TEXT         NOT NULL,
  description   TEXT
                              CHECK (description IS NULL OR char_length(description) <= 500),
  logo_url      TEXT
                              CHECK (logo_url IS NULL OR logo_url ~* '^https?://[^\s]+$'),
  website_url   TEXT
                              CHECK (website_url IS NULL OR website_url ~* '^https?://[^\s]+$'),
  hq_location   TEXT
                              CHECK (hq_location IS NULL OR char_length(hq_location) <= 200),
  industry      TEXT
                              CHECK (industry IS NULL OR char_length(industry) <= 100),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_by    UUID         REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.company_meta ENABLE ROW LEVEL SECURITY;

-- Reads: any authenticated user. Anonymous visitors (landing page, /for-
-- employers) don't read company meta.
DROP POLICY IF EXISTS company_meta_select ON public.company_meta;
CREATE POLICY company_meta_select
  ON public.company_meta FOR SELECT
  TO authenticated
  USING (true);

-- Writes: any E/M who has posted under this company name (i.e. there's a
-- row in `jobs` where lower(company) = name_key AND posted_by = auth.uid()).
-- Admins always pass.
DROP POLICY IF EXISTS company_meta_insert_poster ON public.company_meta;
CREATE POLICY company_meta_insert_poster
  ON public.company_meta FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.jobs j
       WHERE lower(j.company) = name_key
         AND j.posted_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS company_meta_update_poster ON public.company_meta;
CREATE POLICY company_meta_update_poster
  ON public.company_meta FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.jobs j
       WHERE lower(j.company) = name_key
         AND j.posted_by = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.jobs j
       WHERE lower(j.company) = name_key
         AND j.posted_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS company_meta_delete_admin ON public.company_meta;
CREATE POLICY company_meta_delete_admin
  ON public.company_meta FOR DELETE
  TO authenticated
  USING (public.is_admin());
