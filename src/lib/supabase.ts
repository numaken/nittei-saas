import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL as string
const anonKey = process.env.SUPABASE_ANON_KEY as string
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string

export const supabaseAnon = createClient(supabaseUrl, anonKey)
export const supabaseService = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
})
