import { supabaseService } from '@/lib/supabase'

// 既存互換: グローバル管理キー（ADMIN_SECRET）で保護
export function requireAdmin(req: any) {
  const k = req.headers['x-admin-key']
  if (!k || k !== process.env.ADMIN_SECRET) {
    const err: any = new Error('Unauthorized')
    err.status = 401
    throw err
  }
}

// 作成権限: PUBLIC_CREATE=true のときは誰でも、それ以外は requireAdmin
export function requireCreatePermission(req: any) {
  if (process.env.PUBLIC_CREATE === 'true') return
  return requireAdmin(req)
}

// イベントごとの organizer_token か、グローバル ADMIN_SECRET のどちらかOK
export async function requireOrganizerOrAdmin(req: any, eventId: string) {
  const admin = req.headers['x-admin-key']
  if (admin && admin === process.env.ADMIN_SECRET) return

  const organizer = req.headers['x-organizer-key']
  if (!organizer) {
    const err: any = new Error('Unauthorized')
    err.status = 401
    throw err
  }

  const { data: ev, error } = await supabaseService
    .from('events')
    .select('organizer_token')
    .eq('id', eventId)
    .single()

  if (error || !ev || ev.organizer_token !== organizer) {
    const err: any = new Error('Unauthorized')
    err.status = 401
    throw err
  }
}
