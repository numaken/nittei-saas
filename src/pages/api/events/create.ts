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

function allow(res: NextApiResponse) {
  res.setHeader('Allow', 'POST, OPTIONS, HEAD')
  res.setHeader('Cache-Control', 'no-store')
}
async function handlePreflight(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'OPTIONS') { allow(res); return res.status(200).json({ ok: true }) }
  if (req.method === 'HEAD') { allow(res); return res.status(200).end() }
}

function requireEnvOrExplain(res: NextApiResponse) {
  const missing: string[] = []
  if (!process.env.SUPABASE_URL) missing.push('SUPABASE_URL')
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (!process.env.NEXT_PUBLIC_SITE_URL) missing.push('NEXT_PUBLIC_SITE_URL')
  if (missing.length) {
    allow(res)
    res.status(500).json({ error: `Server env missing: ${missing.join(', ')}` })
    return false
  }
  return true
}

function getIP(req: NextApiRequest) {
  const xf = (req.headers['x-forwarded-for'] as string) || ''
  return xf.split(',')[0].trim() || (req.socket as any)?.remoteAddress || 'unknown'
}
async function throttleCreateIfPublic(req: NextApiRequest) {
  if (process.env.PUBLIC_CREATE !== 'true') return
  try {
    const ip = getIP(req)
    const path = '/api/events/create'
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data: rows } = await supabaseService
      .from('rate_limits')
      .select('created_at')
      .eq('ip', ip).eq('path', path).gte('created_at', since)
    if ((rows?.length || 0) >= 5) {
      const err: any = new Error('Too many creates from your IP. Please wait.')
      err.status = 429; throw err
    }
    await supabaseService.from('rate_limits').insert({ ip, path })
  } catch { /* soft-fail */ }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const pre = await handlePreflight(req, res); if (pre !== undefined) return
  if (req.method !== 'POST') { allow(res); return res.status(405).json({ error: 'Method Not Allowed' }) }
  if (!requireEnvOrExplain(res)) return

  try { requireCreatePermission(req) }
  catch (e: any) { return res.status(e.status || 401).json({ error: e.message }) }

  const parsed = Body.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message })
  const b = parsed.data

  try { await throttleCreateIfPublic(req) }
  catch (e: any) { return res.status(e.status || 429).json({ error: e.message || 'throttled' }) }

  const organizerToken = generateToken(24)

  // Try with organizer_token
  const tryInsert = async (withOrganizer: boolean) => {
    const payload: any = {
      title: b.title,
      description: b.description || null,
      duration_min: b.durationMin,
      timezone: b.timezone,
      deadline_at: b.deadlineAt || null
    }
    if (withOrganizer) payload.organizer_token = organizerToken

    return await supabaseService
      .from('events')
      .insert(payload)
      .select('*')
      .single()
  }

  // 1st attempt (with organizer_token)
  let { data: ev, error: e1 }: any = await tryInsert(true)

  // Fallback (no organizer_token)
  if (e1) {
    const r2: any = await tryInsert(false)
    if (r2.error) {
      allow(res)
      return res.status(500).json({
        error: r2.error.message || 'insert events failed',
        code: r2.error.code,
        details: r2.error.details,
        hint: r2.error.hint
      })
    }
    ev = r2.data
  }

  // slots
  const slotsPayload = b.slots.map((s, i) => ({
    event_id: ev.id, start_at: s.startAt, end_at: s.endAt, slot_index: i
  }))
  const rSlots: any = await supabaseService.from('event_slots').insert(slotsPayload).select('*')
  if (rSlots.error) {
    allow(res); return res.status(500).json({
      error: rSlots.error.message, code: rSlots.error.code, details: rSlots.error.details, hint: rSlots.error.hint
    })
  }

  // participants
  const participantsPayload = b.participants.map(p => ({
    event_id: ev.id, name: p.name || null, email: p.email || null, role: p.role, invite_token: generateToken(16)
  }))
  const rParts: any = await supabaseService.from('participants').insert(participantsPayload).select('*')
  if (rParts.error) {
    allow(res); return res.status(500).json({
      error: rParts.error.message, code: rParts.error.code, details: rParts.error.details, hint: rParts.error.hint
    })
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const invites = (rParts.data || []).map((p: any) => ({
    name: p.name, email: p.email, url: `${baseUrl}/event/${ev.id}?t=${p.invite_token}`
  }))
  const organizerKey =
    (ev && typeof (ev as any).organizer_token === 'string') ? (ev as any).organizer_token : undefined

  allow(res)
  return res.status(200).json({ event: ev, slots: rSlots.data, participants: rParts.data, invites, organizerKey })
}
