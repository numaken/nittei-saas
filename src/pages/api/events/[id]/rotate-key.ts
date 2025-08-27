import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '@/lib/supabase'
import { requireOrganizerOrAdmin } from '@/lib/admin'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  const { id } = req.query
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'invalid id' })

  try { await requireOrganizerOrAdmin(req, id) } // 現在の鍵 or ADMIN_SECRET が必要
  catch (e: any) { return res.status(e.status || 401).json({ error: e.message }) }

  const { data, error } = await supabaseService.rpc('sql', {}) // ダミー(使わない)
  // シンプルに UPDATE で再発行
  const { data: updated, error: e2 } = await supabaseService
    .from('events')
    .update({ organizer_token: (Math.random().toString(36) + crypto.randomUUID()).replace(/-/g, '').slice(0, 32) })
    .eq('id', id)
    .select('organizer_token')
    .single()

  if (e2) return res.status(500).json({ error: e2.message })
  return res.status(200).json({ ok: true, organizerKey: updated?.organizer_token })
}
