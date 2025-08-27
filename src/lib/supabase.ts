import { createClient } from '@supabase/supabase-js'

// ※ ここでは throw しない。API側で存在チェックして親切なJSONを返す
const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export const supabaseService = createClient(
  url || 'http://localhost',            // ダミー（ENV無い場合でも型的に通す）
  serviceKey || 'invalid-key',          // ダミー
  { auth: { persistSession: false } }
)
