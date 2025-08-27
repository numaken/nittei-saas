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
  const [copied, setCopied] = useState<string>('')

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
    alert('確定しました。右上の「ICSダウンロード」から配布できます。')
  }

  const icsUrl = summary?.event?.id ? `/api/events/${summary.event.id}/ics` : '#'

  const copy = async (txt: string) => {
    await navigator.clipboard.writeText(txt)
    setCopied('copied')
    setTimeout(() => setCopied(''), 1200)
  }

  return (
    <main className="uk-container">
      {/* Sticky bar */}
      <div className="sticky-bar">
        <div className="hero uk-container">
          <div>
            <h1 className="title">幹事ダッシュボード</h1>
            <p className="sub">最適候補の可視化とリンク配布</p>
          </div>
          <div className="uk-margin-auto-left">
            <a href={icsUrl} className="uk-button btn-ghost">ICS ダウンロード</a>
          </div>
        </div>
      </div>

      {summary ? (
        <div className="uk-margin-large-top">
          <div className="uk-card uk-card-default uk-card-body">
            <div className="uk-flex uk-flex-middle uk-flex-between">
              <div>
                <h2 className="uk-margin-remove">{summary.event.title}</h2>
                {summary.event.description && <p className="uk-text-muted uk-margin-small">{summary.event.description}</p>}
              </div>
              <div>
                <span className="badge badge-ok">◎ yes = 2</span>
                <span className="badge badge-maybe uk-margin-small-left">△ maybe = 1</span>
                <span className="badge badge-ng uk-margin-small-left">× no = 0</span>
              </div>
            </div>
          </div>

          {/* Top 3 cards */}
          <div className="uk-child-width-1-3@m uk-grid-small uk-margin" uk-grid="true">
            {top3.map(s => {
              const total = Math.max(1, s.yes + s.maybe + s.no)
              const okW = (s.yes / total) * 100, mayW = (s.maybe / total) * 100, ngW = 100 - okW - mayW
              return (
                <div key={s.id}>
                  <div className="uk-card uk-card-default uk-card-body">
                    <h3 className="uk-card-title uk-margin-remove-bottom">{new Date(s.start_at).toLocaleString()}</h3>
                    <div className="uk-text-meta">～ {new Date(s.end_at).toLocaleTimeString()}</div>
                    <div className="uk-margin-small">
                      <span className="badge badge-ok">◎ {s.yes}</span>
                      <span className="badge badge-maybe uk-margin-small-left">△ {s.maybe}</span>
                      <span className="badge badge-ng uk-margin-small-left">× {s.no}</span>
                    </div>
                    <div className="meter uk-margin-small-top">
                      <div className="ok" style={{ width: `${okW}%` }} />
                      <div className="maybe" style={{ width: `${mayW}%` }} />
                      <div className="ng" style={{ width: `${ngW}%` }} />
                    </div>
                    <div className="uk-flex uk-flex-middle uk-margin-small-top">
                      <div className="uk-text-bold">Score {s.score.toFixed(1)}</div>
                      <button className="uk-button uk-button-primary uk-margin-small-left" onClick={() => decide(s.id)}>
                        この候補で確定
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* invites */}
          <div className="uk-card uk-card-default uk-card-body uk-margin">
            <div className="uk-flex uk-flex-middle uk-flex-between">
              <h3 className="uk-margin-remove">参加リンク</h3>
              <div className="uk-inline">
                <input type="password" className="uk-input" placeholder="ADMIN_SECRET" value={adminKey} onChange={e => setAdminKey(e.target.value)} style={{ width: 240 }} />
                <button className="uk-button btn-ghost uk-margin-small-left" onClick={fetchInvites}>取得</button>
              </div>
            </div>
            <ul className="uk-list uk-list-divider uk-margin-small-top">
              {invites.map(p => (
                <li key={p.id} className="invite-item">
                  <div>
                    <div className="uk-text-bold">{p.name || p.email || '参加者'}</div>
                    <div className="invite-url uk-text-muted">{p.url}</div>
                  </div>
                  <div>
                    <span className="badge">{p.role}</span>
                    <button className="uk-button uk-button-text uk-margin-small-left" onClick={() => copy(p.url)}>
                      📋 コピー
                    </button>
                  </div>
                </li>
              ))}
              {invites.length === 0 && <li className="uk-text-muted">ADMIN_SECRET を入力して「取得」を押すと、配布用URLが表示されます。</li>}
            </ul>
            {copied && <div className="uk-alert-success uk-margin-small" uk-alert="true"><p>コピーしました</p></div>}
            {error && <div className="uk-alert-danger uk-margin-small" uk-alert="true"><p>{error}</p></div>}
          </div>

          {/* heatmap table */}
          <div className="uk-card uk-card-default uk-card-body uk-margin">
            <h3 className="uk-margin-remove">全候補のヒートマップ</h3>
            <div className="uk-overflow-auto">
              <table className="uk-table uk-table-divider uk-table-small">
                <thead>
                  <tr>
                    <th>候補日時</th><th>スコア</th><th>◎</th><th>△</th><th>×</th><th>割合</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.slots.map(s => {
                    const total = Math.max(1, s.yes + s.maybe + s.no)
                    const okW = (s.yes / total) * 100, mayW = (s.maybe / total) * 100, ngW = 100 - okW - mayW
                    return (
                      <tr key={s.id}>
                        <td>{new Date(s.start_at).toLocaleString()} ～ {new Date(s.end_at).toLocaleTimeString()}</td>
                        <td><b>{s.score.toFixed(1)}</b></td>
                        <td>{s.yes}</td>
                        <td>{s.maybe}</td>
                        <td>{s.no}</td>
                        <td style={{ width: 260 }}>
                          <div className="meter">
                            <div className="ok" style={{ width: `${okW}%` }} />
                            <div className="maybe" style={{ width: `${mayW}%` }} />
                            <div className="ng" style={{ width: `${ngW}%` }} />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : <p>読み込み中…</p>}
    </main>
  )
}
