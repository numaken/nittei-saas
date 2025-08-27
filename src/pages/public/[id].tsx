import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

type Slot = { id: string; start_at: string; end_at: string; slot_index?: number }
type Counts = { yes: number; maybe: number; no: number; score: number }
type Summary = { event: { id: string; title: string; description?: string; duration_min: number; timezone?: string }, slots: Slot[], counts: Record<string, Counts> }

function fmtRangeInTZ(startIso: string, endIso: string, tz: string) {
  const sd = new Date(startIso), ed = new Date(endIso)
  const dateFmt = new Intl.DateTimeFormat('ja-JP', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' })
  const timeFmt = new Intl.DateTimeFormat('ja-JP', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false })
  return `${dateFmt.format(sd)} ${timeFmt.format(sd)}〜${timeFmt.format(ed)} (${tz})`
}

export default function PublicResultPage() {
  const router = useRouter()
  const { id } = router.query as { id?: string }
  const [data, setData] = useState<Summary | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
      ; (async () => {
        try {
          const res = await fetch(`/api/events/${id}/public-summary`)
          const d = await res.json()
          if (!res.ok) throw new Error(d?.error || `HTTP ${res.status}`)
          setData(d)
        } catch (e: any) { setErr(e.message) }
      })()
  }, [id])

  if (err) return <p style={{ color: 'red' }}>⚠️ {err}</p>
  if (!data) return <p>読み込み中…</p>

  return (
    <div style={{ maxWidth: 800, margin: '24px auto', padding: '0 16px' }}>
      <h1>{data.event.title} の結果</h1>
      {data.event.description && <p>{data.event.description}</p>}
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 12 }}>
        {data.slots.map(s => (
          <li key={s.id} style={{ border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              {fmtRangeInTZ(s.start_at, s.end_at, data.event.timezone || 'Asia/Tokyo')}
            </div>
            <div>
              ◎ {data.counts[s.id]?.yes ?? 0}
              △ {data.counts[s.id]?.maybe ?? 0}
              × {data.counts[s.id]?.no ?? 0}
            </div>
          </li>
        ))}
      </ul>
      <p style={{ marginTop: 16, color: '#666', fontSize: 13 }}>
        ※ 個別の回答は表示されません（匿名集計のみ）
      </p>
    </div>
  )
}
