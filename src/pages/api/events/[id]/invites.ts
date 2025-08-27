import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  try { requireAdmin(req) } catch (e: any) { return res.status(e.status || 401).json({ error: e.message }) }
  const { id } = req.query
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'invalid id' })

  const { data: event, error: e0 } = await supabaseService.from('events').select('id,title,description').eq('id', id).single()
  if (e0 || !event) return res.status(404).json({ error: 'not found' })

  const { data: participants, error: e1 } = await supabaseService
    .from('participants')
    .select('id,name,email,role,invite_token')
    .eq('event_id', id)
    .order('role', { ascending: false })
  if (e1) return res.status(500).json({ error: e1.message })

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const invites = (participants || []).map(p => ({
    id: p.id,
    name: p.name,
    email: p.email,
    role: p.role,
    url: `${baseUrl}/event/${id}?t=${p.invite_token}`
  }))
  res.status(200).json({ event, invites })
}
