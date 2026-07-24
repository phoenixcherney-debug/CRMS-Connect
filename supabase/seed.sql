-- CRMS Connect v2 seed — demo accounts and a believable board.
-- Not a migration: run once against a fresh v2 database (or after wiping auth.users).
-- Passwords are psql variables — run with:
--   psql $DB_URL -v demo_password='…' -v staff_password='…' -f supabase/seed.sql
-- (The repo is public: never commit real passwords here.)
--
-- SAFETY: this provisions demo accounts — including a standing demo ADMIN — with
-- shared, known passwords for tests/handoff. NEVER run it against a database that
-- holds real users. Give the demo admin a unique per-environment password (its own
-- var, not the same one your real staff use) and rotate any shared password after a
-- handoff. See "Deployment invariants" in README.md.

-- ---------------------------------------------------------------------------
-- Auth users (handle_new_user builds profiles from the metadata)
-- ---------------------------------------------------------------------------
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   confirmation_token, recovery_token, email_change, email_change_token_new,
   email_change_token_current, phone_change, phone_change_token, reauthentication_token)
values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'phoenix@cherney.com', extensions.crypt(:'staff_password', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"role":"member","full_name":"Phoenix Cherney","affiliation":"faculty_staff","title":"College & Career Counseling"}',
   now() - interval '90 days', now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'casey.ortega@example.com', extensions.crypt(:'demo_password', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"role":"member","full_name":"Casey Ortega","affiliation":"alumni","class_year":"2002","organization":"Roaring Fork Veterinary Clinic","title":"Veterinarian & Owner"}',
   now() - interval '60 days', now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'jordan.whitfield@example.com', extensions.crypt(:'demo_password', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"role":"member","full_name":"Jordan Whitfield","affiliation":"alumni","class_year":"1995","organization":"Ridgeline Software","title":"Engineering Manager"}',
   now() - interval '55 days', now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'priya.natarajan@example.com', extensions.crypt(:'demo_password', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"role":"member","full_name":"Priya Natarajan","affiliation":"parent","organization":"Natarajan Design Studio","title":"Architect"}',
   now() - interval '40 days', now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated',
   'robin.marsh@example.com', extensions.crypt(:'demo_password', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"role":"member","full_name":"Robin Marsh","affiliation":"alumni","class_year":"1988","organization":"Marsh River Outfitters","title":"Founder"}',
   now() - interval '2 days', now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'avery.kim@crms.org', extensions.crypt(:'demo_password', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"role":"student","full_name":"Avery Kim","class_year":"2027"}',
   now() - interval '30 days', now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'miles.tanaka@crms.org', extensions.crypt(:'demo_password', extensions.gen_salt('bf')), now(),
   '{"role":"student"}'::jsonb || '{"provider":"email","providers":["email"]}'::jsonb,
   '{"role":"student","full_name":"Miles Tanaka","class_year":"2026"}',
   now() - interval '28 days', now(), '', '', '', '', '', '', '', ''),
  -- Dedicated demo admin, kept separate from any real staff email so its
  -- password stays known for tests/handoff. This is a standing privileged
  -- account — prefer a unique per-environment password (its own psql var) and
  -- do not seed it into any database with real users.
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-0000000000de', 'authenticated', 'authenticated',
   'demo.admin@example.com', extensions.crypt(:'staff_password', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"role":"member","full_name":"Demo Staff","affiliation":"faculty_staff","title":"CRMS Connect Admin (demo)"}',
   now() - interval '90 days', now(), '', '', '', '', '', '', '', ''),
  -- Gating fixtures: one pending member (approval queue / waiting room) and one
  -- disabled account (disabled screen). Used by e2e/gating.spec.ts.
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-0000000000fe', 'authenticated', 'authenticated',
   'pending.demo@example.com', extensions.crypt(:'demo_password', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"role":"member","full_name":"Pending Demo","affiliation":"alumni","class_year":"2010"}',
   now() - interval '1 day', now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-0000000000da', 'authenticated', 'authenticated',
   'disabled.demo@example.com', extensions.crypt(:'demo_password', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"role":"student","full_name":"Disabled Demo","class_year":"2027"}',
   now() - interval '20 days', now(), '', '', '', '', '', '', '', '');

insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', u.id::text, now(), u.created_at, now()
from auth.users u;

-- ---------------------------------------------------------------------------
-- Profile touch-ups (runs as service context: guard triggers allow it)
-- ---------------------------------------------------------------------------
update public.profiles set role = 'admin', account_status = 'active', approved_at = now()
where id in ('a0000000-0000-4000-8000-000000000001',   -- Phoenix Cherney (school staff)
             'a0000000-0000-4000-8000-0000000000de');  -- Demo Staff (tests/handoff)

-- Approve the established members; Robin stays pending to populate the queue.
update public.profiles set account_status = 'active'
where id in ('b0000000-0000-4000-8000-000000000001',
             'b0000000-0000-4000-8000-000000000002',
             'b0000000-0000-4000-8000-000000000003');

-- Gating fixtures: keep Pending Demo pending, and disable Disabled Demo.
update public.profiles set account_status = 'disabled'
where id = 'a0000000-0000-4000-8000-0000000000da';

update public.profiles set
  location = 'Basalt, CO',
  bio = 'Large-animal vet in the valley since 2010. CRMS is where I fell in love with fieldwork — happy to open the clinic doors to current Oysters.',
  tags = array['Veterinary medicine', 'Animal science', 'Running a small business']
where id = 'b0000000-0000-4000-8000-000000000001';

update public.profiles set
  location = 'Denver, CO',
  bio = 'I run a web platform team at Ridgeline. I got my start because an older Oyster took a chance on me in 1996 — paying that forward.',
  tags = array['Software engineering', 'Web development', 'College CS']
where id = 'b0000000-0000-4000-8000-000000000002';

update public.profiles set
  location = 'Carbondale, CO',
  bio = 'Architect and current CRMS parent. I design mountain homes and small studios, and I love teaching students how buildings actually happen.',
  tags = array['Architecture', 'Design', 'Sustainable building']
where id = 'b0000000-0000-4000-8000-000000000003';

update public.profiles set
  location = 'Carbondale, CO',
  bio = 'CRMS College & Career Counseling. I review every new member and keep an eye on the board — flag anything that feels off.'
where id = 'a0000000-0000-4000-8000-000000000001';

update public.profiles set
  bio = 'Junior. Into biology, skiing, and the farm program. Hoping to work with animals after CRMS.',
  tags = array['Biology', 'Veterinary medicine', 'Outdoor work']
where id = 'c0000000-0000-4000-8000-000000000001';

update public.profiles set
  bio = 'Senior. I build small web projects and help run the AV booth for assemblies.',
  tags = array['Programming', 'Music production']
where id = 'c0000000-0000-4000-8000-000000000002';

-- ---------------------------------------------------------------------------
-- The board
-- ---------------------------------------------------------------------------
insert into public.offers (id, posted_by, kind, title, description, location_mode, location_text, timeframe, commitment, spots, status, created_at) values
  ('d0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'shadow_day',
   'Shadow a large-animal vet for a day',
   E'Spend a full day with me on ranch calls around the valley — vaccinations, checkups, maybe an emergency if the day goes sideways (they usually do).\n\nYou''ll see what veterinary medicine actually looks like outside a textbook: the driving, the paperwork, the ranchers, the animals. Bring boots you don''t mind ruining.\n\nNo experience needed. If you''re curious about vet school, pre-med, or just like animals, raise your hand and tell me why.',
   'in_person', 'Basalt & ranches nearby', 'Any school break', 'One full day', 2, 'open', now() - interval '21 days'),
  ('d0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'internship',
   'Paid summer internship: junior web developer',
   E'My team at Ridgeline builds mapping software for backcountry logistics. I have budget for one CRMS student this summer: 8 weeks, paid, real tickets on a real codebase (TypeScript/React).\n\nYou don''t need to be an expert — you need to have built *something* on your own (a game, a site, a bot) and be able to talk about it. We''ll pair you with a mentor engineer.\n\nThis is the kind of role we''d never post publicly — I''d rather give it to an Oyster.',
   'flexible', 'Denver or remote', 'Summer 2027', 'Full-time, 8 weeks', 1, 'open', now() - interval '14 days'),
  ('d0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000002', 'career_chat',
   '30 minutes on studying CS in college',
   E'Thinking about majoring in computer science, or not sure whether it''s for you? I interview new grads every month and I''m happy to give you the unfiltered version: what actually matters, what doesn''t, and what I wish I''d known at CRMS.\n\nLow stakes — one video call, come with questions.',
   'remote', null, 'Ongoing', 'One video call', 5, 'open', now() - interval '10 days'),
  ('d0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000003', 'project_help',
   'Design a backyard studio with a working architect',
   E'I''m designing a small artist''s studio for a client in Carbondale and I''d love a student collaborator for the early phase: site sketches, massing models, materials research.\n\nWe''d meet at my studio roughly weekly. You''ll come out of it with a real portfolio piece and an honest picture of what architects do all day (hint: it''s not all drawing).\n\nGood fit if you like drawing, making, or engineering — no software experience required.',
   'in_person', 'Carbondale, CO', 'This semester', '~3 hrs/week', 1, 'open', now() - interval '6 days'),
  ('d0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001', 'mentorship',
   'Monthly check-ins for a student headed toward medicine',
   E'If you''re seriously considering medicine (human or animal), I''ll be your sounding board this year: one call or coffee a month, plus honest answers about the path — courses, applications, debt, the parts nobody mentions.\n\nI''m a better fit for the ''is this life for me?'' questions than for test prep.',
   'flexible', 'Basalt / video', 'This school year', 'One hour a month', 1, 'open', now() - interval '4 days');

-- ---------------------------------------------------------------------------
-- Hand-raises and threads
-- ---------------------------------------------------------------------------
insert into public.requests (id, offer_id, student_id, note, status, decided_at, created_at) values
  ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'Hi Dr. Ortega — I''m a junior and I work the morning shift on the school farm (mostly the goats). I''ve wanted to see real vet work up close for years. I''m free any day over spring break and I have my own boots to ruin.',
   'accepted', now() - interval '15 days', now() - interval '18 days'),
  ('e0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001',
   'I''m mostly a bio person but I keep hearing that some CS helps in every science. Could I take one of the chat slots to ask what''s worth learning before college?',
   'in_conversation', null, now() - interval '8 days'),
  ('e0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002',
   'Hi — I''m a senior and I''ve built a couple of things I''m proud of: a site that tracks which dorm chores are done, and a Discord bot our house actually uses. I''d love to work on something real this summer. Happy to share code.',
   'sent', null, now() - interval '3 days');

insert into public.messages (id, request_id, sender_id, body, created_at) values
  ('f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'Goat-shift experience is exactly the right qualification. Spring break works — the second Tuesday is usually a big ranch-call day. Does that work for you?', now() - interval '17 days'),
  ('f0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'That Tuesday works! Should I bring anything besides boots?', now() - interval '16 days'),
  ('f0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'Lunch and a notebook. I''ll confirm the schedule with the school and pick you up at 7am from campus. Accepting your hand-raise now — see you then.', now() - interval '15 days'),
  ('f0000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002',
   'Great question to bring — short answer is ''a semester of Python changes what internships you can get in *any* science.'' Grab a slot: I''m free most weekday evenings. What works?', now() - interval '7 days');

-- Clear the notification noise generated by seeding, then add one realistic one.
delete from public.notifications;
insert into public.notifications (user_id, kind, title, body, link, created_at) values
  ('b0000000-0000-4000-8000-000000000002', 'request_received', 'Miles Tanaka raised a hand',
   'On your offer “Paid summer internship: junior web developer”', '/offers/d0000000-0000-4000-8000-000000000002/manage', now() - interval '3 days'),
  ('c0000000-0000-4000-8000-000000000001', 'request_update', 'They want to talk!',
   '“30 minutes on studying CS in college” — the poster replied to your note.', '/requests/e0000000-0000-4000-8000-000000000002', now() - interval '7 days');
