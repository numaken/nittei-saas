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
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'invalid id' })

  // イベント情報
  const { data: ev, error: e0 } = await supabaseService
    .from('events')
    .select('id,title,description,duration_min,timezone,deadline_at')
    .eq('id', id).single()
  if (e0 || !ev) return res.status(404).json({ error: 'event not found' })

  // 締切チェック
  if (ev.deadline_at && new Date(ev.deadline_at) > new Date()) {
    return res.status(403).json({ error: 'まだ公開されていません（締切前）' })
  }

  // 候補
  const { data: slots } = await supabaseService
    .from('event_slots')
    .select('id,start_at,end_at,slot_index')
    .eq('event_id', id)

  // 投票（個人名を伏せる）
  const { data: votes } = await supabaseService
    .from('votes')
    .select('slot_id,choice')
    .eq('event_id', id)

  // 集計
  const counts: Record<string, { yes: number; maybe: number; no: number; score: number }> = {}
  slots?.forEach(s => counts[s.id] = { yes: 0, maybe: 0, no: 0, score: 0 })
  votes?.forEach(v => {
    const c = counts[v.slot_id]; if (!c) return
    if (v.choice === 'yes') { c.yes++; c.score += 2 }
    else if (v.choice === 'maybe') { c.maybe++; c.score += 1 }
    else if (v.choice === 'no') { c.no++ }
  })

  allow(res)
  return res.status(200).json({ event: ev, slots, counts })
}
