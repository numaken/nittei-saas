import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { supabaseService } from '@/lib/supabase'
import { generateToken } from '@/lib/magic'
import { requireCreatePermission } from '@/lib/admin'

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
    role: z.enum(['must', 'member', 'optional']).default('member')
  })).min(1)
})

function allow(res: NextApiResponse) {
  res.setHeader('Allow', 'POST, OPTIONS, HEAD')
  res.setHeader('Cache-Control', 'no-store')
}
async function preflight(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'OPTIONS') { allow(res); return res.status(200).json({ ok: true }) }
  if (req.method === 'HEAD') { allow(res); return res.status(200).end() }
}
function requireEnvOrExplain(res: NextApiResponse) {
  const miss: string[] = []
  if (!process.env.SUPABASE_URL) miss.push('SUPABASE_URL')
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) miss.push('SUPABASE_SERVICE_ROLE_KEY')
  if (!process.env.NEXT_PUBLIC_SITE_URL) miss.push('NEXT_PUBLIC_SITE_URL')
  if (miss.length) { allow(res); res.status(500).json({ error: `Server env missing: ${miss.join(', ')}` }); return false }
  return true
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const pre = await preflight(req, res); if (pre !== undefined) return
  if (req.method !== 'POST') { allow(res); return res.status(405).json({ error: 'Method Not Allowed' }) }
  if (!requireEnvOrExplain(res)) return

  try { requireCreatePermission(req) }
  catch (e: any) { return res.status(e.status || 401).json({ error: e.message }) }

  const parsed = Body.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message })
  const b = parsed.data

  // 1) events 挿入（organizer_token は DB の DEFAULT で自動付与）
  const { data: ev, error: e1 } = await supabaseService
    .from('events')
    .insert({
      title: b.title,
      description: b.description || null,
      duration_min: b.durationMin,
      timezone: b.timezone,
      deadline_at: b.deadlineAt || null
    })
    .select('*')
    .single()
  if (e1 || !ev) { allow(res); return res.status(500).json({ error: e1?.message || 'insert events failed' }) }

  // 2) slots
  const slotsPayload = b.slots.map((s, i) => ({
    event_id: ev.id, start_at: s.startAt, end_at: s.endAt, slot_index: i
  }))
  const rSlots: any = await supabaseService.from('event_slots').insert(slotsPayload).select('*')
  if (rSlots.error) { allow(res); return res.status(500).json({ error: rSlots.error.message }) }

  // 3) participants（招待トークン付与）
  const participantsPayload = b.participants.map(p => ({
    event_id: ev.id, name: p.name || null, email: p.email || null, role: p.role,
    invite_token: generateToken(16)
  }))
  const rParts: any = await supabaseService.from('participants').insert(participantsPayload).select('*')
  if (rParts.error) { allow(res); return res.status(500).json({ error: rParts.error.message }) }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL!
  const invites = (rParts.data || []).map((p: any) => ({
    name: p.name, email: p.email, url: `${baseUrl}/event/${ev.id}?t=${p.invite_token}`
  }))

  allow(res)
  return res.status(200).json({
    event: ev,
    slots: rSlots.data,
    participants: rParts.data,
    invites,
    organizerKey: (ev as any).organizer_token // ★ DBが自動生成した鍵を返す
  })
}
