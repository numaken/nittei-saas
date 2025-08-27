// src/pages/api/events/create.ts
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

// --- Optional throttle when PUBLIC_CREATE=true -------------------------------

function getIP(req: NextApiRequest) {
  const xf = (req.headers['x-forwarded-for'] as string) || ''
  const ip = xf.split(',')[0].trim() || (req.socket as any)?.remoteAddress || 'unknown'
  return ip
}

async function throttleCreateIfPublic(req: NextApiRequest) {
  if (process.env.PUBLIC_CREATE !== 'true') return
  try {
    const ip = getIP(req)
    const path = '/api/events/create'
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString() // last 60 min
    // Count recent rows
    const { data: rows, error: e1 } = await supabaseService
      .from('rate_limits')
      .select('created_at')
      .eq('ip', ip)
      .eq('path', path)
      .gte('created_at', since)
    if (e1) {
      // If table doesn't exist or RLS blocks, just skip throttling (soft-fail)
      return
    }
    if ((rows?.length || 0) >= 5) {
      const err: any = new Error('Too many creates from your IP. Please wait.')
      err.status = 429
      throw err
    }
    // Record this call
    await supabaseService.from('rate_limits').insert({ ip, path })
  } catch {
    // Soft-fail: never break create flow due to throttle errors
    return
  }
}

// -----------------------------------------------------------------------------

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }
  // 1) Permission: ADMIN only or PUBLIC_CREATE=true
  try {
    requireCreatePermission(req)
  } catch (e: any) {
    return res.status(e.status || 401).json({ error: e.message })
  }

  // 2) Validate body
  const parsed = Body.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message })
  const b = parsed.data

  // 3) Optional throttle for public mode
  try {
    await throttleCreateIfPublic(req)
  } catch (e: any) {
    return res.status(e.status || 429).json({ error: e.message || 'throttled' })
  }

  // 4) Insert event (with organizer_token if column exists)
  const organizerToken = generateToken(24) // per-event organizer key (for co-organizers)
  let ev: any | null = null
  let e1: any | null = null

  // First try: insert with organizer_token (column may or may not exist)
  {
    const { data, error } = await supabaseService
      .from('events')
      .insert({
        title: b.title,
        description: b.description || null,
        duration_min: b.durationMin,
        timezone: b.timezone,
        deadline_at: b.deadlineAt || null,
        organizer_token: organizerToken
      } as any)
      .select('*')
      .single()
    ev = data
    e1 = error
  }

  // Fallback: if column doesn't exist, retry without it
  if (e1) {
    const { data, error } = await supabaseService
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
    ev = data
    e1 = error
  }

  if (e1 || !ev) {
    return res.status(500).json({ error: e1?.message || 'insert events failed' })
  }

  // 5) Insert slots
  const slotsPayload = b.slots.map((s, i) => ({
    event_id: ev.id,
    start_at: s.startAt,
    end_at: s.endAt,
    slot_index: i
  }))
  const { data: slots, error: e2 } = await supabaseService
    .from('event_slots')
    .insert(slotsPayload)
    .select('*')
  if (e2) return res.status(500).json({ error: e2.message })

  // 6) Insert participants (with invite tokens)
  const participantsPayload = b.participants.map(p => ({
    event_id: ev.id,
    name: p.name || null,
    email: p.email || null,
    role: p.role,
    invite_token: generateToken(16)
  }))
  const { data: participants, error: e3 } = await supabaseService
    .from('participants')
    .insert(participantsPayload)
    .select('*')
  if (e3) return res.status(500).json({ error: e3.message })

  // 7) Build invite links
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const invites = (participants || []).map((p: any) => ({
    name: p.name,
    email: p.email,
    url: `${baseUrl}/event/${ev.id}?t=${p.invite_token}`
  }))

  // If organizer_token column exists, ev.organizer_token should be present
  const organizerKey: string | undefined =
    (ev && typeof (ev as any).organizer_token === 'string') ? (ev as any).organizer_token : undefined

  return res.status(200).json({
    event: ev,
    slots,
    participants,
    invites,
    // When PUBLIC_CREATE=true でも、ここに per-event の鍵を返すので
    // 共同幹事は /organizer/<id> で x-organizer-key にこれを入れて操作できます
    organizerKey
  })
}
