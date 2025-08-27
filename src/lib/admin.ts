export function requireAdmin(req: any) {
  const k = req.headers['x-admin-key']
  if (!k || k !== process.env.ADMIN_SECRET) {
    const err: any = new Error('Unauthorized')
    ;(err as any).status = 401
    throw err
  }
}
