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

  try { await requireOrganizerOrAdmin(req, id) }
  catch (e: any) { return res.status(e.status || 401).json({ error: e.message }) }

  const { data: event, error: e0 } = await supabaseService
    .from('events').select('id,title,description').eq('id', id).single()
  if (e0 || !event) return res.status(404).json({ error: 'not found' })

  const { data: participants, error: e1 } = await supabaseService
    .from('participants')
    .select('id,name,email,role,invite_token')
    .eq('event_id', id)
    .order('role', { ascending: false })
  if (e1) return res.status(500).json({ error: e1.message })

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const invites = (participants || []).map(p => ({
    id: p.id, name: p.name, email: p.email, role: p.role,
    url: `${baseUrl}/event/${id}?t=${p.invite_token}`
  }))

  allow(res)
  return res.status(200).json({ event, invites })
}
