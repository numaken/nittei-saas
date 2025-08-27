import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { supabaseService } from '@/lib/supabase'
import { generateToken } from '@/lib/magic'
import { requireAdmin } from '@/lib/admin'

const Body = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  durationMin: z.number().int().positive(),
  timezone: z.string().default('Asia/Tokyo'),
  deadlineAt: z.string().datetime().optional(),
  slots: z.array(z.object({
    startAt: z.string().datetime(),
    endAt: z.string().datetime()
  })).min(1),
  participants: z.array(z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    role: z.enum(['must','member','optional']).default('member')
  })).min(1)
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  try {
    requireAdmin(req)
  } catch (e: any) {
    return res.status(e.status || 401).json({ error: e.message })
  }
  const parsed = Body.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message })
  const b = parsed.data

  const { data: ev, error: e1 } = await supabaseService
    .from('events')
    .insert({
      title: b.title,
      description: b.description || null,
      duration_min: b.durationMin,
      timezone: b.timezone,
      deadline_at: b.deadlineAt || null
    })
    .select('*').single()
  if (e1 || !ev) return res.status(500).json({ error: e1?.message || 'insert events failed' })

  // slots
  const slotsPayload = b.slots.map((s, i) => ({
    event_id: ev.id,
    start_at: s.startAt,
    end_at: s.endAt,
    slot_index: i
  }))
  const { data: slots, error: e2 } = await supabaseService.from('event_slots').insert(slotsPayload).select('*')
  if (e2) return res.status(500).json({ error: e2.message })

  // participants with tokens
  const participantsPayload = b.participants.map(p => ({
    event_id: ev.id,
    name: p.name || null,
    email: p.email || null,
    role: p.role,
    invite_token: generateToken(16)
  }))
  const { data: participants, error: e3 } = await supabaseService.from('participants').insert(participantsPayload).select('*')
  if (e3) return res.status(500).json({ error: e3.message })

  // Build invite links
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const invites = (participants || []).map((p: any) => ({
    name: p.name,
    email: p.email,
    url: `${baseUrl}/event/${ev.id}?t=${p.invite_token}`
  }))

  return res.status(200).json({ event: ev, slots, participants, invites })
}
