import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { supabaseService } from '@/lib/supabase'

/** 「abc123 山田: https://...」のように余計な文字が付いても、英数字の先頭塊だけをトークンとして抽出 */
function sanitizeToken(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const m = raw.match(/[A-Za-z0-9]+/)
  return m ? m[0] : null
}

const Body = z.object({
  token: z.string().min(1),                 // まずは受け取り
  slotId: z.string().min(1),                // UUID想定だが厳密にしない
  choice: z.enum(['yes', 'maybe', 'no']),
})

function allow(res: NextApiResponse) {
  res.setHeader('Allow', 'POST, OPTIONS, HEAD')
  res.setHeader('Cache-Control', 'no-store')
}
async function preflight(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'OPTIONS') { allow(res); return res.status(200).json({ ok: true }) }
  if (req.method === 'HEAD') { allow(res); return res.status(200).end() }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const pre = await preflight(req, res); if (pre !== undefined) return
  if (req.method !== 'POST') { allow(res); return res.status(405).json({ error: 'Method Not Allowed' }) }

  const { id } = req.query
  if (!id || typeof id !== 'string') { allow(res); return res.status(400).json({ error: 'invalid id' }) }

  // 1) 入力を検証
  const parsed = Body.safeParse(req.body)
  if (!parsed.success) {
    allow(res); return res.status(400).json({ error: parsed.error.issues || parsed.error.message })
  }
  const sToken = sanitizeToken(parsed.data.token)
  if (!sToken) { allow(res); return res.status(401).json({ error: 'invalid token' }) }
  const slotId = parsed.data.slotId
  const choice = parsed.data.choice

  // 2) 参加者トークンの認証（イベントID + invite_token の一致が必要）
  const { data: participant, error: eP } = await supabaseService
    .from('participants')
    .select('id')
    .eq('event_id', id)
    .eq('invite_token', sToken)
    .single()
  if (eP || !participant) { allow(res); return res.status(401).json({ error: 'Unauthorized' }) }

  // 3) スロットの所属チェック（別イベントのスロットに投票させない）
  const { data: slot, error: eS } = await supabaseService
    .from('event_slots')
    .select('id')
    .eq('id', slotId)
    .eq('event_id', id)
    .single()
  if (eS || !slot) { allow(res); return res.status(400).json({ error: 'invalid slot' }) }

  // 4) 投票を保存（同じ参加者×スロットは上書き）
  // 既存スキーマ想定: votes(event_id uuid, participant_id uuid, slot_id uuid, choice text, updated_at timestamptz)
  // もしテーブル名/カラムが違う場合は onConflict を合わせてください。
  const { error: eUp } = await supabaseService
    .from('votes')
    .upsert({
      event_id: id,
      participant_id: participant.id,
      slot_id: slotId,
      choice,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'participant_id,slot_id' })
  if (eUp) { allow(res); return res.status(500).json({ error: eUp.message }) }

  allow(res)
  return res.status(200).json({ ok: true })
}
