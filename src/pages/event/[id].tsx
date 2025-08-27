import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

type Slot = { id: string, start_at: string, end_at: string, score?: number, yes?: number, maybe?: number, no?: number }
type Summary = { event: { id: string, title: string, description?: string, duration_min: number }, slots: Slot[] }

export default function EventVote() {
  const router = useRouter()
  const { id, t } = router.query
  const [summary, setSummary] = useState<Summary | null>(null)
  const [selected, setSelected] = useState<{[slotId: string]: 'yes'|'maybe'|'no'|''}>({})
  const [msg, setMsg] = useState<string>('')

  useEffect(() => {
    if (!id) return
    fetch(`/api/events/${id}/summary`).then(r => r.json()).then(setSummary)
  }, [id])

  const submit = async (slotId: string, choice: 'yes'|'maybe'|'no') => {
    setMsg('送信中...')
    const res = await fetch(`/api/events/${id}/vote?t=${t}`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ slotId, choice })
    })
    if (res.ok) {
      setSelected(prev => ({...prev, [slotId]: choice}))
      setMsg('保存しました')
    } else {
      const j = await res.json().catch(()=>({error:'Error'}))
      setMsg(j.error || 'エラー')
    }
  }

  return (
    <main style={{padding:24, maxWidth:960, margin:'0 auto'}}>
      <h1>候補日時に回答</h1>
      {!summary ? <p>読み込み中...</p> : (
        <>
          <h2>{summary.event.title}</h2>
          {summary.event.description && <p>{summary.event.description}</p>}
          <table style={{width:'100%', borderCollapse:'collapse'}}>
            <thead>
              <tr>
                <th style={{textAlign:'left'}}>候補</th>
                <th>◎</th>
                <th>△</th>
                <th>×</th>
              </tr>
            </thead>
            <tbody>
              {summary.slots.map(s => (
                <tr key={s.id} style={{borderTop:'1px solid #ddd'}}>
                  <td style={{padding:'8px 4px'}}>
                    {new Date(s.start_at).toLocaleString()} - {new Date(s.end_at).toLocaleTimeString()}
                  </td>
                  <td><button onClick={()=>submit(s.id,'yes')} disabled={selected[s.id]==='yes'}>行ける</button></td>
                  <td><button onClick={()=>submit(s.id,'maybe')} disabled={selected[s.id]==='maybe'}>調整可</button></td>
                  <td><button onClick={()=>submit(s.id,'no')} disabled={selected[s.id]==='no'}>不可</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>{msg}</p>
        </>
      )}
    </main>
  )
}
