-- 077_interest_taxonomy.sql
-- Task 12 — collapse the 19-entry INTEREST_OPTIONS list into 8 broad
-- buckets so filters across /students, /opportunities, and student-
-- posts are actually navigable. Also adds profiles.specific_interests
-- (free-text tags) so a student can still surface "robotics" or
-- "Arabic" without us bloating the taxonomy.
--
-- Migration is in-place: existing profile rows have their `interests`
-- array remapped + deduplicated. The same mapping is mirrored in
-- src/data/interest-migration.ts so the client agrees with whatever
-- new writes go in.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS specific_interests TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_specific_interests_max20;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_specific_interests_max20
    CHECK (array_length(specific_interests, 1) IS NULL OR array_length(specific_interests, 1) <= 20);

-- Remap existing profile.interests via a temporary mapping table.
WITH map(old_key, new_key) AS (
  VALUES
    ('Technology',                     'Technology & Engineering'),
    ('Engineering',                    'Technology & Engineering'),
    ('Architecture & Design',          'Technology & Engineering'),
    ('Finance & Banking',              'Finance, Business & Government'),
    ('Consulting',                     'Finance, Business & Government'),
    ('Real Estate',                    'Finance, Business & Government'),
    ('Government & Public Policy',     'Finance, Business & Government'),
    ('Law & Legal',                    'Finance, Business & Government'),
    ('Healthcare & Medicine',          'Healthcare & Science'),
    ('Science & Research',             'Healthcare & Science'),
    ('Arts & Entertainment',           'Arts, Media & Communications'),
    ('Marketing & Communications',     'Arts, Media & Communications'),
    ('Environmental & Sustainability', 'Environment, Agriculture & Outdoors'),
    ('Agriculture & Ranching',         'Environment, Agriculture & Outdoors'),
    ('Education',                      'Education & Social Impact'),
    ('Non-Profit & Social Impact',     'Education & Social Impact'),
    ('Hospitality & Tourism',          'Hospitality, Sports & Recreation'),
    ('Sports & Recreation',            'Hospitality, Sports & Recreation'),
    ('Other',                          'Other')
)
UPDATE public.profiles p
   SET interests = (
     SELECT array_agg(DISTINCT coalesce(m.new_key, raw)) FROM unnest(p.interests) AS raw
       LEFT JOIN map m ON m.old_key = raw
   )
 WHERE p.interests IS NOT NULL
   AND array_length(p.interests, 1) IS NOT NULL;

-- Same remapping for student_posts.interests (used by the directory
-- filter on /student-posts).
WITH map(old_key, new_key) AS (
  VALUES
    ('Technology',                     'Technology & Engineering'),
    ('Engineering',                    'Technology & Engineering'),
    ('Architecture & Design',          'Technology & Engineering'),
    ('Finance & Banking',              'Finance, Business & Government'),
    ('Consulting',                     'Finance, Business & Government'),
    ('Real Estate',                    'Finance, Business & Government'),
    ('Government & Public Policy',     'Finance, Business & Government'),
    ('Law & Legal',                    'Finance, Business & Government'),
    ('Healthcare & Medicine',          'Healthcare & Science'),
    ('Science & Research',             'Healthcare & Science'),
    ('Arts & Entertainment',           'Arts, Media & Communications'),
    ('Marketing & Communications',     'Arts, Media & Communications'),
    ('Environmental & Sustainability', 'Environment, Agriculture & Outdoors'),
    ('Agriculture & Ranching',         'Environment, Agriculture & Outdoors'),
    ('Education',                      'Education & Social Impact'),
    ('Non-Profit & Social Impact',     'Education & Social Impact'),
    ('Hospitality & Tourism',          'Hospitality, Sports & Recreation'),
    ('Sports & Recreation',            'Hospitality, Sports & Recreation'),
    ('Other',                          'Other')
)
UPDATE public.student_posts sp
   SET interests = (
     SELECT array_agg(DISTINCT coalesce(m.new_key, raw)) FROM unnest(sp.interests) AS raw
       LEFT JOIN map m ON m.old_key = raw
   )
 WHERE sp.interests IS NOT NULL
   AND array_length(sp.interests, 1) IS NOT NULL;
