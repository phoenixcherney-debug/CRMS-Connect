// send-push — deliver an opt-in web push for one notification.
//
// Called by the `dispatch_push` DB trigger (see the push_notifications
// migration) whenever a notification row is inserted for a user who has at
// least one push subscription. Authenticated by a shared hook secret, not a
// user JWT (verify_jwt is disabled for this function on purpose).
//
// Required env (set in the Supabase dashboard → Edge Functions → Secrets):
//   PUSH_HOOK_SECRET  — must equal Vault's `push_hook_secret`
//   VAPID_PUBLIC_KEY  — from `npx web-push generate-vapid-keys`
//   VAPID_PRIVATE_KEY — from the same command
//   VAPID_SUBJECT     — a mailto: or https: contact URL
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const HOOK_SECRET = Deno.env.get("PUSH_HOOK_SECRET");
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:connect@crms.org";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface Subscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Shared-secret auth: only the DB trigger knows PUSH_HOOK_SECRET.
  const auth = req.headers.get("Authorization");
  if (!HOOK_SECRET || auth !== `Bearer ${HOOK_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    // Push not yet configured — return 503 so the wiring is still observable.
    return new Response("Push not configured", { status: 503 });
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  let payload: { user_id?: string; title?: string; body?: string | null; link?: string | null };
  try {
    payload = await req.json();
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  const { user_id, title, body, link } = payload;
  if (!user_id || !title) {
    return new Response("Missing user_id or title", { status: 400 });
  }

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", user_id);
  if (error) {
    return new Response(`Lookup failed: ${error.message}`, { status: 500 });
  }

  const notificationPayload = JSON.stringify({
    title,
    body: body ?? "",
    link: link ?? "/notifications",
  });

  let sent = 0;
  const dead: string[] = [];
  for (const s of (subs ?? []) as Subscription[]) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        notificationPayload,
      );
      sent++;
    } catch (err) {
      // 404/410 mean the browser dropped the subscription — prune it.
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) dead.push(s.id);
    }
  }
  if (dead.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", dead);
  }

  return new Response(JSON.stringify({ sent, cleaned: dead.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
