-- 046_student_posts_one_open.sql
-- S7.1 — server-side enforcement of "one open post per student".
--
-- The UI already gates the "New post" button on `openPosts.length === 0`,
-- so a hand-crafted insert is the only path that could create a duplicate.
-- Adding a partial unique index closes that.
--
-- Verified before applying: the production student_posts table has zero
-- students with multiple open posts (group-by-student-id where is_closed
-- = false having count > 1 returned []), so the index can be created
-- without a backfill pass.

CREATE UNIQUE INDEX IF NOT EXISTS student_posts_one_open_per_student
  ON public.student_posts (student_id)
  WHERE is_closed = false;
