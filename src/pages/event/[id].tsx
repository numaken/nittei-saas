import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

type Slot = { id: string, start_at: string, end_at: string }
type Summary = { event: { id: string, title: string, description?: string, duration_min: number }, slots: Slot[] }

export default function EventVote() {
  const router = useRouter()
  const { id, t } = router.query
  const [summary, setSummary] = useState<Summary | null>(null)
  const [selected, setSelected] = useState<{ [slotId: string]: 'yes' | 'maybe' | 'no' | '' }>({})
  const [msg, setMsg] = useState<string>('')

  useEffect(() => {
    if (!id) return
    fetch(`/api/events/${id}/summary`).then(r => r.json()).then(setSummary)
  }, [id])

  const submit = async (slotId: string, choice: 'yes' | 'maybe' | 'no') => {
    setMsg('送信中...')
    const res = await fetch(`/api/events/${id}/vote?t=${t}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotId, choice })
    })
    if (res.ok) {
      setSelected(prev => ({ ...prev, [slotId]: choice }))
      setMsg('保存しました ✔')
      setTimeout(() => setMsg(''), 1200)
    } else {
      const j = await res.json().catch(() => ({ error: 'Error' }))
      setMsg(j.error || 'エラー')
    }
  }

  return (
    <main className="uk-container uk-margin-large-top">
      <div className="uk-card uk-card-default uk-card-body">
        <h1 className="uk-margin-remove">{summary?.event.title || '候補日時に回答'}</h1>
        {summary?.event.description && <p className="uk-text-muted uk-margin-small">{summary.event.description}</p>}
        <p className="uk-text-meta">各候補に「◎ 行ける」「△ 調整可」「× 不可」を選んでください。</p>
      </div>

      {!summary ? <p>読み込み中...</p> : (
        <div className="uk-child-width-1-2@m uk-grid-small uk-margin" uk-grid="true">
          {summary.slots.map(s => {
            const val = selected[s.id]
            return (
              <div key={s.id}>
                <div className="uk-card uk-card-default uk-card-body">
                  <h3 className="uk-card-title uk-margin-remove-bottom">
                    {new Date(s.start_at).toLocaleString()}
                  </h3>
                  <div className="uk-text-meta">～ {new Date(s.end_at).toLocaleTimeString()}</div>
                  <div className="uk-button-group uk-margin-top">
                    <button className={`uk-button ${val === 'yes' ? 'uk-button-primary' : 'btn-ghost'}`} onClick={() => submit(s.id, 'yes')}>◎ 行ける</button>
                    <button className={`uk-button ${val === 'maybe' ? 'uk-button-default' : 'btn-ghost'}`} onClick={() => submit(s.id, 'maybe')}>△ 調整可</button>
                    <button className={`uk-button ${val === 'no' ? 'uk-button-danger' : 'btn-ghost'}`} onClick={() => submit(s.id, 'no')}>× 不可</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {msg && <div className="uk-alert-success"><p>{msg}</p></div>}
    </main>
  )
}
