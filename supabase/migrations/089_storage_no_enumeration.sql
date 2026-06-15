-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 089: stop object enumeration on public buckets (A6)
--
-- The avatars and marketplace-photos buckets had broad SELECT policies on
-- storage.objects, letting anyone list/enumerate their contents (e.g. which
-- users have avatars, by uid-prefixed paths). These buckets are public, so
-- images are still served by the public object endpoint regardless of RLS —
-- the client only ever uses getPublicUrl(), never .list()/.download(). Dropping
-- these SELECT policies removes enumeration while keeping public read intact.
-- The resumes bucket (private, properly gated) is untouched.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Avatar objects are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS marketplace_photos_read ON storage.objects;
