import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'

type Slot = {
  id: string
  start_at: string
  end_at: string
  slot_index?: number
}

type Summary = {
  event: {
    id: string
    title: string
    description?: string
    duration_min: number
    timezone?: string
  }
  slots: Slot[]
}

type Choice = 'yes' | 'maybe' | 'no'

/** URLの ?t= に余計な文字が付いていても、英数字の先頭塊だけを招待トークンとして抽出 */
function extractToken(raw?: string) {
  if (!raw) return undefined
  const m = String(raw).match(/[A-Za-z0-9]+/)
  return m ? m[0] : undefined
}

/** イベントのタイムゾーンで「YYYY/M/D(曜) HH:mm 〜 HH:mm (TZ)」に整形 */
function fmtRangeInTZ(startIso: string, endIso: string, tz: string) {
  const sd = new Date(startIso)
  const ed = new Date(endIso)

  const dateFmt = new Intl.DateTimeFormat('ja-JP', {
    timeZone: tz,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  })
  const timeFmt = new Intl.DateTimeFormat('ja-JP', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const datePart = dateFmt.format(sd) // 2025/8/30(土)
  const sPart = timeFmt.format(sd) // 04:00
  const ePart = timeFmt.format(ed) // 06:00
  return `${datePart} ${sPart} 〜 ${ePart} (${tz})`
}

export default function EventPage() {
  const router = useRouter()
  const { id, t: rawT } = router.query as { id?: string; t?: string }
  const token = extractToken(rawT)

  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 自分の投票（この端末でのローカル保持。サーバ保存は /vote で行う）
  const [myChoices, setMyChoices] = useState<Record<string, Choice | undefined>>({})

  const tz = summary?.event?.timezone || 'Asia/Tokyo'

  useEffect(() => {
    if (!id) return
      ; (async () => {
        setLoading(true)
        setError(null)
        try {
          const res = await fetch(`/api/events/${id}/summary`)
          const data = await res.json()
          if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
          setSummary(data as Summary)
        } catch (e: any) {
          setError(e.message || '読み込みに失敗しました')
        } finally {
          setLoading(false)
        }
      })()
  }, [id])

  const sortedSlots = useMemo(() => {
    const list = summary?.slots || []
    return [...list].sort((a, b) => {
      if (a.slot_index != null && b.slot_index != null) return a.slot_index - b.slot_index
      return a.start_at.localeCompare(b.start_at)
    })
  }, [summary])

  async function vote(slotId: string, choice: Choice) {
    if (!id) return
    if (!token) {
      alert('招待URLが正しくありません（?t= のトークンが見つかりません）')
      return
    }
    try {
      const res = await fetch(`/api/events/${id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, slotId, choice }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)

      // ローカル表示を更新（サーバ側は保存済み）
      setMyChoices((prev) => ({ ...prev, [slotId]: choice }))
    } catch (e: any) {
      alert(e.message || '投票に失敗しました')
    }
  }

  function Btn({
    active,
    onClick,
    children,
  }: {
    active?: boolean
    onClick: () => void
    children: React.ReactNode
  }) {
    return (
      <button
        onClick={onClick}
        style={{
          padding: '10px 14px',
          borderRadius: 6,
          border: '1px solid ' + (active ? '#2b6cb0' : '#ddd'),
          background: active ? '#2b6cb0' : '#f5f5f5',
          color: active ? '#fff' : '#333',
          cursor: 'pointer',
        }}
      >
        {children}
      </button>
    )
  }

  return (
    <div style={{ maxWidth: 960, margin: '24px auto', padding: '0 16px', lineHeight: 1.6 }}>
      <header
        style={{
          background: '#fff',
          border: '1px solid #eee',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          borderRadius: 6,
          padding: '16px 20px',
          marginBottom: 20,
        }}
      >
        <h1 style={{ margin: 0 }}>{summary?.event?.title || 'イベント'}</h1>
        <p style={{ margin: '8px 0 0', color: '#666' }}>
          各候補に「◎ 行ける」「△ 調整可」「× 不可」を選んでください。
        </p>
      </header>

      {!token && (
        <p style={{ color: '#b00020', marginBottom: 16 }}>
          ⚠️ 招待トークン（URL の <code>?t=</code>）が見つかりません。配布されたURLからアクセスしてください。
        </p>
      )}

      {error && <p style={{ color: '#b00020' }}>⚠️ {error}</p>}
      {loading && <p>読み込み中…</p>}

      {sortedSlots.map((s) => {
        const chosen = myChoices[s.id]
        return (
          <div
            key={s.id}
            style={{
              background: '#fff',
              border: '1px solid #eee',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              borderRadius: 6,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              {fmtRangeInTZ(s.start_at, s.end_at, tz)}
            </div>
            <div style={{ color: '#666', fontSize: 12, marginBottom: 12 }}>
              所要時間: {summary?.event?.duration_min ?? 0}分
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn active={chosen === 'yes'} onClick={() => vote(s.id, 'yes')}>
                ◎ 行ける
              </Btn>
              <Btn active={chosen === 'maybe'} onClick={() => vote(s.id, 'maybe')}>
                △ 調整可
              </Btn>
              <Btn active={chosen === 'no'} onClick={() => vote(s.id, 'no')}>
                × 不可
              </Btn>
            </div>
          </div>
        )
      })}

      {!loading && sortedSlots.length === 0 && (
        <p>候補がまだありません。幹事に追加してもらってください。</p>
      )}
    </div>
  )
}
