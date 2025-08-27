import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '@/lib/supabase'

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const { data, error } = await supabaseService
      .from('events')
      .insert({ title: 'debug-from-api', duration_min: 60, timezone: 'Asia/Tokyo' })
      .select('*')
      .single()

    if (error) return res.status(500).json({
      ok: false, where: 'insert', error: error.message, code: (error as any).code, details: (error as any).details, hint: (error as any).hint
    })
    return res.status(200).json({ ok: true, data })
  } catch (e: any) {
    return res.status(500).json({ ok: false, where: 'catch', error: e.message })
  }
}
