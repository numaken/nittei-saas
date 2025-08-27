import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '@/lib/supabase'

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const { data, error } = await supabaseService.from('events').select('id').limit(1)
    if (error) return res.status(500).json({ ok: false, where: 'select', error: error.message, code: (error as any).code, details: (error as any).details, hint: (error as any).hint })
    return res.status(200).json({ ok: true, sample: data })
  } catch (e: any) {
    return res.status(500).json({ ok: false, where: 'catch', error: e.message })
  }
}
