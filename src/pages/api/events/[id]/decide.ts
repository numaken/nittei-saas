import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '@/lib/supabase'
import { requireOrganizerOrAdmin } from '@/lib/admin'

function allow(res: NextApiResponse) {
  res.setHeader('Allow', 'POST, OPTIONS, HEAD')
  res.setHeader('Cache-Control', 'no-store')
}
async function preflight(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'OPTIONS') { allow(res); return res.status(200).json({ ok: true }) }
  if (req.method === 'HEAD') { allow(res); return res.status(200).end() }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const pre = await preflight(req, res); if (pre !== undefined) return
  if (req.method !== 'POST') { allow(res); return res.status(405).json({ error: 'Method Not Allowed' }) }

  const { id } = req.query
  if (!id || typeof id !== 'string') { allow(res); return res.status(400).json({ error: 'invalid id' }) }

  try { await requireOrganizerOrAdmin(req, id) }
  catch (e: any) { return res.status(e.status || 401).json({ error: e.message }) }

  const { slotId } = req.body || {}
  if (!slotId) return res.status(400).json({ error: 'slotId required' })

  const { data: slot, error: e1 } = await supabaseService
    .from('event_slots').select('*').eq('id', slotId).eq('event_id', id).single()
  if (e1 || !slot) return res.status(400).json({ error: 'invalid slot' })

  const { error: e2 } = await supabaseService.from('decisions').insert({
    event_id: id,
    slot_id: slotId,
    decided_by: 'organizer',
    decided_at: new Date().toISOString(),
    ics_uid: crypto.randomUUID()
  })
  if (e2) return res.status(500).json({ error: e2.message })

  allow(res)
  return res.status(200).json({ ok: true })
}
