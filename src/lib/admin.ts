import { supabaseService } from '@/lib/supabase'

export function requireAdmin(req: any) {
  const k = req.headers['x-admin-key']
  if (!k || k !== process.env.ADMIN_SECRET) {
    const err: any = new Error('Unauthorized'); (err as any).status = 401; throw err
  }
}

// PUBLIC_CREATE=true のときは作成は誰でもOK。それ以外は requireAdmin。
export function requireCreatePermission(req: any) {
  if (process.env.PUBLIC_CREATE === 'true') return
  return requireAdmin(req)
}
