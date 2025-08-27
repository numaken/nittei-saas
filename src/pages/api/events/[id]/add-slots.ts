import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { supabaseService } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'

const Body = z.object({
  slots: z.array(z.object({
    startAt: z.string().datetime(),
    endAt: z.string().datetime()
  })).min(1)
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  try { requireAdmin(req) } catch (e: any) { return res.status(e.status||401).json({error:e.message}) }
  const { id } = req.query
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'invalid id' })
  const parsed = Body.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message })
  const b = parsed.data

  // get current max index
  const { data: current, error: e0 } = await supabaseService
    .from('event_slots').select('slot_index').eq('event_id', id).order('slot_index', { ascending: false }).limit(1).maybeSingle()
  const startIdx = (current?.slot_index ?? -1) + 1
  const slotsPayload = b.slots.map((s, i) => ({
    event_id: id,
    start_at: s.startAt,
    end_at: s.EndAt || s.endAt,
    slot_index: startIdx + i
  }))
  const { data, error } = await supabaseService.from('event_slots').insert(slotsPayload).select('*')
  if (error) return res.status(500).json({ error: error.message })
  res.status(200).json({ slots: data })
}
