import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { supabaseService } from '@/lib/supabase'

const Body = z.object({
  slotId: z.string().uuid(),
  choice: z.enum(['yes','maybe','no']),
  comment: z.string().optional()
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { id } = req.query
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'invalid id' })

  const token = (req.query.t || req.headers['x-invite-token']) as string | undefined
  if (!token) return res.status(401).json({ error: 'missing token' })

  const parsed = Body.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message })
  const b = parsed.data

  // find participant by token
  const { data: participant, error: e1 } = await supabaseService
    .from('participants').select('*').eq('event_id', id).eq('invite_token', token).single()
  if (e1 || !participant) return res.status(401).json({ error: 'invalid token' })

  // ensure slot belongs to event
  const { data: slot, error: e2 } = await supabaseService
    .from('event_slots').select('id').eq('id', b.slotId).eq('event_id', id).single()
  if (e2 || !slot) return res.status(400).json({ error: 'invalid slot' })

  // upsert vote
  const payload = {
    event_id: id,
    slot_id: b.slotId,
    participant_id: participant.id,
    choice: b.choice,
    comment: b.comment || null,
    updated_at: new Date().toISOString()
  }
  const { error: e3 } = await supabaseService
    .from('votes')
    .upsert(payload, { onConflict: 'slot_id,participant_id' })
  if (e3) return res.status(500).json({ error: e3.message })

  await supabaseService.from('participants').update({ last_seen_at: new Date().toISOString() }).eq('id', participant.id)
  res.status(200).json({ ok: true })
}
