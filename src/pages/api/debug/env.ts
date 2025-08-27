import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    SUPABASE_URL_set: !!process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY_set: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_SITE_URL_set: !!process.env.NEXT_PUBLIC_SITE_URL,
    PUBLIC_CREATE: process.env.PUBLIC_CREATE ?? '(unset)',
    MODE: process.env.VERCEL_ENV || 'unknown'
  })
}
