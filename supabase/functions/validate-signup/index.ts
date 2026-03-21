// Supabase Edge Function: validate-signup
//
// PURPOSE: Server-side email/role validation that runs after a user signs up.
//
// DEPLOYMENT:
//   supabase functions deploy validate-signup
//
// USAGE — two modes:
//
// 1. As a direct callable function (called by the client right after signUp):
//    await supabase.functions.invoke('validate-signup', { body: { userId, email, role } })
//
// 2. As a Supabase Auth Hook (recommended for true server-side enforcement):
//    Dashboard → Authentication → Hooks → Add "After Sign Up" webhook
//    pointing to: https://<project-ref>.supabase.co/functions/v1/validate-signup

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ValidationPayload {
  // Direct call fields
  userId?: string
  email?: string
  role?: string
  // Auth Hook fields (Supabase webhook format)
  type?: string
  event?: string
  user_id?: string
  email_address?: string
  metadata?: {
    role?: string
    [key: string]: unknown
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload: ValidationPayload = await req.json()

    // Normalize fields — support both direct call and auth hook formats
    const userId = payload.userId ?? payload.user_id
    const email = (payload.email ?? payload.email_address ?? '').toLowerCase()
    const role = payload.role ?? payload.metadata?.role

    if (!userId || !email || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userId, email, role' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const isSchoolEmail = email.endsWith('@crms.org')

    let validationError: string | null = null

    if (role === 'student' && !isSchoolEmail) {
      validationError = 'Student accounts require a @crms.org school email address.'
    } else if ((role === 'alumni' || role === 'parent') && isSchoolEmail) {
      validationError = 'Please use a personal email address, not your school email.'
    }

    if (validationError) {
      // Delete the user using the service role key so they cannot log in
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        { auth: { autoRefreshToken: false, persistSession: false } }
      )

      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
      if (deleteError) {
        console.error('Failed to delete invalid user:', deleteError.message)
      }

      return new Response(
        JSON.stringify({ error: validationError }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 422 }
      )
    }

    return new Response(
      JSON.stringify({ message: 'Email and role validated successfully.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('validate-signup error:', message)
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
