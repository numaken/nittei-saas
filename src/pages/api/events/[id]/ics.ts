import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '@/lib/supabase'
import { buildICS } from '@/lib/ics'

function toICSDate(s: string) {
  // input: ISO string
  const d = new Date(s)
  const yyyy = d.getUTCFullYear().toString().padStart(4,'0')
  const mm = (d.getUTCMonth()+1).toString().padStart(2,'0')
  const dd = d.getUTCDate().toString().padStart(2,'0')
  const hh = d.getUTCHours().toString().padStart(2,'0')
  const mi = d.getUTCMinutes().toString().padStart(2,'0')
  const ss = d.getUTCSeconds().toString().padStart(2,'0')
  return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const { id } = req.query
  if (!id || typeof id !== 'string') return res.status(400).end('invalid id')

  const { data: decision } = await supabaseService.from('decisions').select('*').eq('event_id', id).order('decided_at', {ascending:false}).limit(1).single()
  if (!decision) return res.status(404).end('no decision')

  const { data: event } = await supabaseService.from('events').select('*').eq('id', id).single()
  const { data: slot } = await supabaseService.from('event_slots').select('*').eq('id', decision.slot_id).single()

  if (!event || !slot) return res.status(404).end('not found')

  const ics = buildICS({
    uid: decision.ics_uid || `${event.id}@nittei`,
    startUTC: toICSDate(slot.start_at),
    endUTC: toICSDate(slot.end_at),
    title: event.title,
    description: [event.description, `${process.env.NEXT_PUBLIC_SITE_URL}/event/${event.id}`].filter(Boolean).join('\n'),
    url: `${process.env.NEXT_PUBLIC_SITE_URL}/event/${event.id}`
  })
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="event-${event.id}.ics"`)
  res.status(200).send(ics)
}
