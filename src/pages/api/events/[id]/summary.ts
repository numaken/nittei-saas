import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '@/lib/supabase'

function allow(res: NextApiResponse) {
  res.setHeader('Allow', 'GET, OPTIONS, HEAD')
  res.setHeader('Cache-Control', 'no-store')
}
async function preflight(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'OPTIONS') { allow(res); return res.status(200).json({ ok: true }) }
  if (req.method === 'HEAD') { allow(res); return res.status(200).end() }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const pre = await preflight(req, res); if (pre !== undefined) return
  if (req.method !== 'GET') { allow(res); return res.status(405).json({ error: 'Method Not Allowed' }) }

  const { id } = req.query
  if (!id || typeof id !== 'string') { allow(res); return res.status(400).json({ error: 'invalid id' }) }

  const { data: event, error: e0 } = await supabaseService
    .from('events')
    .select('id,title,description,duration_min,timezone')
    .eq('id', id)
    .single()
  if (e0 || !event) return res.status(404).json({ error: 'not found' })

  const { data: slots, error: e1 } = await supabaseService
    .from('event_slots')
    .select('id,start_at,end_at,slot_index,meta_json')
    .eq('event_id', id)
    .order('slot_index')
  if (e1) return res.status(500).json({ error: e1.message })

  allow(res)
  return res.status(200).json({ event, slots })
}
