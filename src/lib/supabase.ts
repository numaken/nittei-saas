import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export const supabaseService = createClient(
  url || 'http://invalid.supabase.co',
  serviceKey || 'invalid-key',
  { auth: { persistSession: false } }
)
