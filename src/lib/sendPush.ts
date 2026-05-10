import { supabase } from './supabase'

/** P1-12 — known event categories the send-push function consults
 *  against profiles.notification_preferences. Adding a new category
 *  here doesn't require a migration; missing keys in the prefs JSON
 *  default to "send", so existing users won't suddenly stop receiving
 *  pushes when a category gets introduced. */
export type PushEvent =
  | 'message'
  | 'application_in'
  | 'application_status'
  | 'meeting_request'
  | 'student_post_match'

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  url?: string,
  event?: PushEvent,
): Promise<void> {
  try {
    await supabase.functions.invoke('send-push', {
      body: { user_id: userId, title, body, url, event },
    })
  } catch {
    // Push is best-effort — never block the main action
  }
}
