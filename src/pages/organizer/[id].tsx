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
    <main className="uk-container uk-margin-large-top">
      <h1 className="uk-heading-line"><span>幹事ダッシュボード</span></h1>

      {summary ? (
        <>
          <h2 className="uk-heading-bullet">{summary.event.title}</h2>
          {summary.event.description && <p className="uk-text-muted">{summary.event.description}</p>}

          {/* Top3 候補 */}
          <div className="uk-child-width-1-3@m uk-grid-small" uk-grid="true">
            {top3.map(s => (
              <div key={s.id}>
                <div className="uk-card uk-card-default uk-card-body">
                  <h3 className="uk-card-title">
                    {new Date(s.start_at).toLocaleString()}<br />
                    ～ {new Date(s.end_at).toLocaleTimeString()}
                  </h3>
                  <p>スコア: <b>{s.score}</b>（◎{s.yes} / △{s.maybe} / ×{s.no}）</p>
                  <progress className="uk-progress" value={s.yes} max={s.yes + s.maybe + s.no}></progress>
                  <button
                    className="uk-button uk-button-primary uk-margin-top"
                    onClick={() => decide(s.id)}
                  >
                    この候補で確定
                  </button>
                </div>
              </div>
            ))}
          </div>

          <a href={icsUrl} className="uk-button uk-button-default uk-margin-top">
            ICS ダウンロード
          </a>

          {/* 参加リンク */}
          <div className="uk-card uk-card-secondary uk-card-body uk-margin-top">
            <h3 className="uk-card-title">参加リンク</h3>
            <div className="uk-margin">
              <input type="password" className="uk-input" placeholder="ADMIN_SECRET" value={adminKey} onChange={e => setAdminKey(e.target.value)} />
              <button className="uk-button uk-button-default uk-margin-small-left" onClick={fetchInvites}>取得</button>
            </div>
            <ul className="uk-list uk-list-divider">
              {invites.map(p => (
                <li key={p.id}>
                  {p.name || p.email || '参加者'}（{p.role}）：
                  <a href={p.url} target="_blank" rel="noreferrer">{p.url}</a>
                  <button className="uk-button uk-button-text uk-margin-small-left" onClick={() => navigator.clipboard.writeText(p.url)}>📋 コピー</button>
                </li>
              ))}
            </ul>
          </div>

          {/* ヒートマップ */}
          <div className="uk-overflow-auto uk-margin-top">
            <table className="uk-table uk-table-striped uk-table-small">
              <thead>
                <tr>
                  <th>候補日時</th><th>スコア</th><th>◎</th><th>△</th><th>×</th><th>割合</th>
                </tr>
              </thead>
              <tbody>
                {summary.slots.map(s => {
                  const total = s.yes + s.maybe + s.no || 1
                  return (
                    <tr key={s.id}>
                      <td>{new Date(s.start_at).toLocaleString()}</td>
                      <td>{s.score.toFixed(1)}</td>
                      <td>{s.yes}</td>
                      <td>{s.maybe}</td>
                      <td>{s.no}</td>
                      <td>
                        <div className="uk-flex">
                          <div style={{ width: `${(s.yes / total) * 100}%`, background: '#4caf50', height: 10 }}></div>
                          <div style={{ width: `${(s.maybe / total) * 100}%`, background: '#ffc107', height: 10 }}></div>
                          <div style={{ width: `${(s.no / total) * 100}%`, background: '#f44336', height: 10 }}></div>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : <p>読み込み中...</p>}
    </main>
  )
}
