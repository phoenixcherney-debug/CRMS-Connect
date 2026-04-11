import { supabase } from './supabase'

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  url?: string
): Promise<void> {
  try {
    await supabase.functions.invoke('send-push', {
      body: { user_id: userId, title, body, url },
    })
  } catch {
    // Push is best-effort — never block the main action
  }
}
