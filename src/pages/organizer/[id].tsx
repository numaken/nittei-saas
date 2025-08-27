import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'

type Slot = { id: string; start_at: string; end_at: string; score: number; yes: number; maybe: number; no: number }
type Summary = { event: { id: string; title: string; description?: string; duration_min: number }; slots: Slot[] }
type Invite = { id: string; name?: string | null; email?: string | null; role: 'must' | 'member' | 'optional'; url: string }

export default function OrganizerView() {
  const router = useRouter()
  const { id } = router.query
  const [adminKey, setAdminKey] = useState('')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [invites, setInvites] = useState<Invite[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    fetch(`/api/events/${id}/summary`).then(r => r.json()).then(setSummary).catch(() => setError('summary取得に失敗'))
  }, [id])

  const fetchInvites = async () => {
    setError(null)
    if (!adminKey) { setError('ADMIN_SECRET を入力'); return }
    const res = await fetch(`/api/events/${id}/invites`, { headers: { 'x-admin-key': adminKey } })
    const j = await res.json()
    if (!res.ok) { setError(j.error || 'invites取得に失敗'); return }
    setInvites(j.invites)
  }

  const top3 = useMemo(() => (summary?.slots || []).slice(0, 3), [summary])

  const decide = async (slotId: string) => {
    setError(null)
    if (!adminKey) { setError('ADMIN_SECRET を入力'); return }
    const res = await fetch(`/api/events/${id}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
      body: JSON.stringify({ slotId })
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { setError(j.error || '確定に失敗'); return }
    alert('確定しました。ICS を配布できます。')
  }

  const icsUrl = summary?.event?.id ? `/api/events/${summary.event.id}/ics` : '#'

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <h1>幹事ダッシュボード</h1>
      {summary ? (
        <>
          <h2 style={{ marginTop: 8 }}>{summary.event.title}</h2>
          {summary.event.description && <p style={{ color: '#555' }}>{summary.event.description}</p>}

          <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
            <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16 }}>
              <h3 style={{ marginTop: 0 }}>上位候補（Top 3）</h3>
              {top3.length === 0 && <p>候補がありません。</p>}
              {top3.map(s => (
                <div key={s.id} style={{ border: '1px solid #eee', borderRadius: 8, padding: 12, marginBottom: 8 }}>
                  <div style={{ fontWeight: 600 }}>
                    {new Date(s.start_at).toLocaleString()} - {new Date(s.end_at).toLocaleTimeString()}
                  </div>
                  <div style={{ fontSize: 12, color: '#666' }}>Score {s.score}（◎{s.yes} / △{s.maybe} / ×{s.no}）</div>
                  <div style={{ height: 10, background: '#f2f2f2', borderRadius: 6, overflow: 'hidden', marginTop: 8 }}>
                    <div style={{ height: '100%', width: `${Math.min(100, (s.yes / (s.yes + s.maybe + s.no || 1)) * 100)}%` }} />
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <button onClick={() => decide(s.id)} style={{ padding: '6px 10px' }}>この候補で確定</button>
                  </div>
                </div>
              ))}
              <a href={icsUrl} style={{ display: 'inline-block', marginTop: 8 }}>確定済みなら ICS をダウンロード</a>
            </div>

            <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16 }}>
              <h3 style={{ marginTop: 0 }}>管理キー（ADMIN_SECRET）</h3>
              <input type="password" placeholder="ADMIN_SECRET" value={adminKey} onChange={e => setAdminKey(e.target.value)} style={{ width: '100%', padding: 8 }} />
              <div style={{ marginTop: 12 }}>
                <button onClick={fetchInvites}>参加リンクを取得</button>
              </div>
              {invites.length > 0 && (
                <ul style={{ marginTop: 12 }}>
                  {invites.map((p) => (
                    <li key={p.id} style={{ marginBottom: 6 }}>
                      {p.name || p.email || '参加者'}（{p.role}）： <a href={p.url} target="_blank" rel="noreferrer">{p.url}</a>
                      <button onClick={() => navigator.clipboard.writeText(p.url)} style={{ marginLeft: 8 }}>コピー</button>
                    </li>
                  ))}
                </ul>
              )}
              {error && <p style={{ color: 'crimson' }}>{error}</p>}
            </div>
          </section>

          <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>ヒートマップ風サマリー</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '6px 4px' }}>候補</th>
                  <th>スコア</th>
                  <th>◎</th>
                  <th>△</th>
                  <th>×</th>
                  <th style={{ textAlign: 'left' }}>ビジュアル</th>
                </tr>
              </thead>
              <tbody>
                {summary.slots.map(s => {
                  const total = Math.max(1, s.yes + s.maybe + s.no)
                  const yesPct = (s.yes / total) * 100
                  const maybePct = (s.maybe / total) * 100
                  const noPct = 100 - yesPct - maybePct
                  return (
                    <tr key={s.id} style={{ borderTop: '1px solid #eee' }}>
                      <td style={{ padding: '6px 4px' }}>{new Date(s.start_at).toLocaleString()} - {new Date(s.end_at).toLocaleTimeString()}</td>
                      <td style={{ textAlign: 'center' }}>{s.score.toFixed(1)}</td>
                      <td style={{ textAlign: 'center' }}>{s.yes}</td>
                      <td style={{ textAlign: 'center' }}>{s.maybe}</td>
                      <td style={{ textAlign: 'center' }}>{s.no}</td>
                      <td>
                        <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', background: '#f2f2f2' }}>
                          <div style={{ width: `${yesPct}%` }} title="yes" />
                          <div style={{ width: `${maybePct}%` }} title="maybe" />
                          <div style={{ width: `${noPct}%` }} title="no" />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        </>
      ) : <p>読み込み中…</p>}
    </main>
  )
}
