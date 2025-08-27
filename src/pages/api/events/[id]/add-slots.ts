import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { supabaseService } from '@/lib/supabase'
import { requireOrganizerOrAdmin } from '@/lib/admin'

const Body = z.object({
  slots: z.array(z.object({
    startAt: z.string().datetime(),
    endAt: z.string().datetime()
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const pre = await handlePreflight(req, res); if (pre !== undefined) return

  if (req.method !== 'POST') {
    allow(res)
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const { id } = req.query
  if (!id || typeof id !== 'string') {
    allow(res); return res.status(400).json({ error: 'invalid event id' })
  }

  // 権限: イベント鍵 または ADMIN_SECRET
  try { await requireOrganizerOrAdmin(req, id) }
  catch (e: any) { return res.status(e.status || 401).json({ error: e.message }) }

  // 入力チェック
  const parsed = Body.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message })
  const b = parsed.data

  // 既存スロット数を確認して連番を付与
  const { count } = await supabaseService
    .from('event_slots')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', id)
  const startIdx = count || 0

  // 追加ペイロード
  const slotsPayload = b.slots.map((s, i) => ({
    event_id: id,
    start_at: s.startAt,
    end_at: s.endAt,   // ← 大文字/小文字ミス対策済み
    slot_index: startIdx + i
  }))

  const { data: inserted, error: eIns } = await supabaseService
    .from('event_slots')
    .insert(slotsPayload)
    .select('*')

  if (eIns) { allow(res); return res.status(500).json({ error: eIns.message }) }

  allow(res)
  return res.status(200).json({ ok: true, slots: inserted })
}
