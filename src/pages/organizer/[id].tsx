import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'

type Slot = {
  id: string
  start_at: string
  end_at: string
  score?: number
  yes?: number
  maybe?: number
  no?: number
}
type Summary = {
  event: { id: string; title: string; description?: string; duration_min: number }
  slots: Slot[]
}

function fmt(iso: string) {
  try {
    const d = new Date(iso)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${y}/${m}/${day} ${hh}:${mm}`
  } catch {
    return iso
  }
}

export default function OrganizerPage() {
  const router = useRouter()
  const { id } = router.query as { id?: string }

  const [sum, setSum] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // 👇 ここがポイント：管理キーは「ADMIN_SECRET でも organizerKey でもOK」
  const [keyInput, setKeyInput] = useState<string>('')
  // 便利のためブラウザに保存
  useEffect(() => {
    const k = localStorage.getItem('organizer-or-admin-key') || ''
    if (k) setKeyInput(k)
  }, [])
  useEffect(() => {
    if (keyInput) localStorage.setItem('organizer-or-admin-key', keyInput)
  }, [keyInput])

  // 初回：サマリー取得（鍵不要の想定。もし401ならボタンで再取得）
  useEffect(() => {
    if (!id) return
      ; (async () => {
        setErr(null); setLoading(true)
        try {
          const res = await fetch(`/api/events/${id}/summary`)
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const data = await res.json()
          setSum(data as Summary)
        } catch (e: any) {
          setErr('概要の取得に失敗しました。管理キーを入力して「再読込」を押してください。')
        } finally {
          setLoading(false)
        }
      })()
  }, [id])

  const sortedSlots = useMemo(() => {
    if (!sum?.slots) return []
    // スコアがあれば降順、それ以外は開始日時昇順
    return [...sum.slots].sort((a, b) => {
      const sa = (a.score ?? 0) - (b.score ?? 0)
      if (sa !== 0) return sa > 0 ? -1 : 1
      return a.start_at.localeCompare(b.start_at)
    })
  }, [sum])

  async function refetchWithKey() {
    if (!id) return
    setErr(null); setLoading(true)
    try {
      const res = await fetch(`/api/events/${id}/summary`, {
        headers: {
          // 同じ値を「両方のヘッダ」に入れる＝ADMIN_SECRET でも organizerKey でも通る
          'x-admin-key': keyInput,
          'x-organizer-key': keyInput,
        }
      })
      const ct = res.headers.get('content-type') || ''
      const data = ct.includes('application/json') ? await res.json() : {}
      if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status}`)
      setSum(data as Summary)
    } catch (e: any) {
      setErr(e.message || '再読込に失敗しました')
    } finally { setLoading(false) }
  }

  async function getInvites() {
    if (!id) return
    setErr(null); setLoading(true)
    try {
      const res = await fetch(`/api/events/${id}/invites`, {
        headers: {
          'x-admin-key': keyInput,
          'x-organizer-key': keyInput,
        }
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
      // クリップボードにまとめてコピー
      const lines = (data.invites || []).map((v: any) =>
        `${v.name || '(名無し)'}: ${v.url}`
      )
      await navigator.clipboard.writeText(lines.join('\n'))
      alert('配布用URLをクリップボードにコピーしました！\n\n' + lines.join('\n'))
    } catch (e: any) {
      setErr(e.message || '取得に失敗しました')
    } finally { setLoading(false) }
  }

  async function decide(slotId: string) {
    if (!id) return
    if (!confirm('この候補で日程を確定します。よろしいですか？')) return
    setErr(null); setLoading(true)
    try {
      const res = await fetch(`/api/events/${id}/decide`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': keyInput,
          'x-organizer-key': keyInput,
        },
        body: JSON.stringify({ slotId })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
      alert('確定しました。右上の「ICSダウンロード」から予定を追加できます。')
    } catch (e: any) {
      setErr(e.message || '確定に失敗しました')
    } finally { setLoading(false) }
  }

  const icsHref = id ? `/api/events/${id}/ics` : '#'

  return (
    <div style={{ maxWidth: 920, margin: '24px auto', padding: '0 16px', lineHeight: 1.6 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <div>
          <h1 style={{ margin: '8px 0' }}>{sum?.event?.title || '幹事ダッシュボード'}</h1>
          {sum?.event?.description && <p>{sum.event.description}</p>}
        </div>
        <a href={icsHref} style={{ padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, textDecoration: 'none' }}>
          ICS ダウンロード
        </a>
      </header>

      <section style={{ marginTop: 12, padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
          管理キー（<u>ADMIN_SECRET または organizerKey</u>）
        </label>
        <input
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          placeholder="ここに貼り付け（第三者に共有しない）"
          style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8 }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button onClick={refetchWithKey} disabled={loading} style={{ padding: '10px 12px' }}>再読込</button>
          <button onClick={getInvites} disabled={loading || !keyInput} style={{ padding: '10px 12px' }}>参加リンクを取得（コピー）</button>
        </div>
        <p style={{ marginTop: 8, color: '#666', fontSize: 13 }}>
          ※ organizerKey はイベント作成時のレスポンスに表示されます。共同幹事にのみ共有してください。
        </p>
      </section>

      {err && <p style={{ color: '#d00', marginTop: 12 }}>⚠️ {err}</p>}

      <section style={{ marginTop: 16 }}>
        <h2 style={{ margin: '8px 0' }}>候補一覧</h2>
        {!sum && loading && <p>読み込み中…</p>}
        {sum && sortedSlots.length === 0 && <p>候補がありません。</p>}
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
          {sortedSlots.map(s => (
            <li key={s.id} style={{ border: '1px solid #eee', borderRadius: 8, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{fmt(s.start_at)} 〜 {fmt(s.end_at)}</div>
                <div style={{ color: '#666', fontSize: 13 }}>
                  ◎{s.yes ?? 0}　△{s.maybe ?? 0}　×{s.no ?? 0}　{typeof s.score === 'number' ? `（score: ${s.score}）` : ''}
                </div>
              </div>
              <button onClick={() => decide(s.id)} disabled={loading || !keyInput} style={{ padding: '8px 12px' }}>この候補で確定</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
