-- 058_display_name_blocklist.sql
-- P0-8 — server-side guardrail on profiles.full_name. Mirrors the
-- patterns in src/lib/nameFilter.ts so a hand-crafted REST call can't
-- slip a name past the client check.
--
-- Patterns are case-insensitive. The check first flattens the name to
-- alphanumerics + the l33t-speak punctuation ($, @, !) so spaces /
-- punctuation can't dodge a match.
--
-- This is intentionally minimal — the broader content-moderation track
-- (obscenity package, registrar review queue) lives separately. Treat
-- this as a P0 belt-and-suspenders, not the full filter.

CREATE OR REPLACE FUNCTION public.validate_display_name_trg()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  flat TEXT;
BEGIN
  IF NEW.full_name IS NULL OR length(btrim(NEW.full_name)) = 0 THEN
    RETURN NEW;
  END IF;

  -- Flatten to a-z 0-9 $ @ ! so spaces / dots / dashes don't dodge.
  flat := lower(regexp_replace(NEW.full_name, '[^a-zA-Z0-9$@!]+', '', 'g'));

  -- Slurs (l33t-speak tolerant — i/1, e/3, a/4/@, o/0, s/5/$, t/7).
  IF flat ~* '(n[i1!]gg[e3]r|n[i1!]gg[a4@]|f[a4@]gg[o0]t|r[e3]t[a4@]rd|tr[a4@]nny|k[i1!]k[e3]|sp[i1!]c|ch[i1!]nk|g[o0][o0]k|w[e3]tb[a4@]ck|c[o0][o0]n|cunt)' THEN
    RAISE EXCEPTION 'crms: display name not allowed' USING ERRCODE = 'check_violation';
  END IF;

  -- Sexual / harassment patterns.
  IF flat ~* '(p[e3]d[o0]|r[a4@]p[i1!]st|m[o0]l[e3]st[e3]r|l[i1!]k[e3]sl[i1!]ttl[e3](b[o0]ys|g[i1!]rls))' THEN
    RAISE EXCEPTION 'crms: display name not allowed' USING ERRCODE = 'check_violation';
  END IF;

  -- Reserved / impersonation. Match against the original (not flattened)
  -- so word boundaries work as expected.
  IF NEW.full_name ~* '\m(registrar|admin(istrator)?|moderator|crms\s*staff|staff)\M' THEN
    RAISE EXCEPTION 'crms: display name not allowed' USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_display_name ON public.profiles;
CREATE TRIGGER validate_display_name
  BEFORE INSERT OR UPDATE OF full_name ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_display_name_trg();
