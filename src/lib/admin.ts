export function requireCreatePermission(req: any) {
  // PUBLIC_CREATE=true のときは誰でも作成OK
  if (process.env.PUBLIC_CREATE === 'true') return

  // それ以外は ADMIN_SECRET が必須
  const k = req.headers['x-admin-key']
  if (!k || k !== process.env.ADMIN_SECRET) {
    const err: any = new Error('Unauthorized')
    err.status = 401
    throw err
  }
}
