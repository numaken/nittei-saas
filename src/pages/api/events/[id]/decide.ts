import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  try { requireAdmin(req) } catch (e: any) { return res.status(e.status||401).json({ error: e.message }) }
  const { id } = req.query
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'invalid id' })
  const { slotId } = req.body || {}
  if (!slotId) return res.status(400).json({ error: 'slotId required' })

  const { data: slot, error: e1 } = await supabaseService.from('event_slots').select('*').eq('id', slotId).eq('event_id', id).single()
  if (e1 || !slot) return res.status(400).json({ error: 'invalid slot' })

  const { error: e2 } = await supabaseService.from('decisions').insert({
    event_id: id, slot_id: slotId, decided_by: 'admin', decided_at: new Date().toISOString(), ics_uid: crypto.randomUUID()
  })
  if (e2) return res.status(500).json({ error: e2.message })
  res.status(200).json({ ok: true })
}
