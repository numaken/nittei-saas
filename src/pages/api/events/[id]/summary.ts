import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const { id } = req.query
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'invalid id' })

  const { data: event, error: e0 } = await supabaseService.from('events').select('*').eq('id', id).single()
  if (e0 || !event) return res.status(404).json({ error: 'not found' })

  const { data: slots, error: e1 } = await supabaseService.from('event_slots').select('*').eq('event_id', id).order('slot_index', { ascending: true })
  if (e1) return res.status(500).json({ error: e1.message })

  const { data: participants } = await supabaseService.from('participants').select('id, role').eq('event_id', id)

  const { data: votes } = await supabaseService.from('votes').select('slot_id, participant_id, choice').eq('event_id', id)
  const roleWeight: Record<string, number> = { must: 2.0, member: 1.0, optional: 0.5 }
  const choiceWeight: Record<string, number> = { yes: 2, maybe: 1, no: 0 }
  const pRole = new Map<string,string>((participants||[]).map(p => [p.id, p.role || 'member']))

  const aggregate = (slotId: string) => {
    const vs = (votes||[]).filter(v => v.slot_id === slotId)
    let score = 0, yes=0, maybe=0, no=0
    for (const v of vs) {
      const rw = roleWeight[pRole.get(v.participant_id) || 'member']
      const cw = choiceWeight[v.choice as keyof typeof choiceWeight]
      score += rw * cw
      if (v.choice === 'yes') yes++
      if (v.choice === 'maybe') maybe++
      if (v.choice === 'no') no++
    }
    return { score, yes, maybe, no }
  }

  const enriched = (slots||[]).map(s => {
    const a = aggregate(s.id)
    return { ...s, ...a }
  }).sort((a,b) => (b.score - a.score) || (b.yes - a.yes) || (new Date(a.start_at).getTime() - new Date(b.start_at).getTime()))

  res.status(200).json({ event, slots: enriched })
}
