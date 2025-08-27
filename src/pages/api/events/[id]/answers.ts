import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '@/lib/supabase'
import { requireOrganizerOrAdmin } from '@/lib/admin'

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

  // 幹事（organizerKey）or 管理者のみ
  try { await requireOrganizerOrAdmin(req, id) }
  catch (e: any) { return res.status(e.status || 401).json({ error: e.message }) }

  // event
  const { data: event, error: e0 } = await supabaseService
    .from('events')
    .select('id,title,timezone')
    .eq('id', id).single()
  if (e0 || !event) return res.status(404).json({ error: 'not found' })

  // slots
  const { data: slots, error: e1 } = await supabaseService
    .from('event_slots')
    .select('id,start_at,end_at,slot_index')
    .eq('event_id', id)
    .order('slot_index', { ascending: true })
  if (e1) return res.status(500).json({ error: e1.message })

  // participants
  const { data: participants, error: e2 } = await supabaseService
    .from('participants')
    .select('id,name,email,role,invited_at')
    .eq('event_id', id)
    .order('invited_at', { ascending: true })
  if (e2) return res.status(500).json({ error: e2.message })

  // votes
  const { data: votes, error: e3 } = await supabaseService
    .from('votes')
    .select('participant_id,slot_id,choice')
    .eq('event_id', id)
  if (e3) return res.status(500).json({ error: e3.message })

  // 集計（yes=2, maybe=1, no=0）
  const counts: Record<string, { yes: number; maybe: number; no: number; score: number }> = {}
  for (const s of (slots || [])) counts[s.id] = { yes: 0, maybe: 0, no: 0, score: 0 }
  for (const v of (votes || [])) {
    const c = counts[v.slot_id]; if (!c) continue
    if (v.choice === 'yes') { c.yes++; c.score += 2 }
    else if (v.choice === 'maybe') { c.maybe++; c.score += 1 }
    else if (v.choice === 'no') { c.no++ }
  }

  allow(res)
  return res.status(200).json({ event, slots, participants, votes, counts })
}
