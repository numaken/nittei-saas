import { useState } from 'react'

type Slot = { startAt: string; endAt: string }
type Participant = { name?: string; email?: string; role: 'must' | 'member' | 'optional' }

export default function NewEvent() {
  const [adminKey, setAdminKey] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [durationMin, setDurationMin] = useState(60)
  const [timezone, setTimezone] = useState('Asia/Tokyo')
  const [deadlineAt, setDeadlineAt] = useState('') // ISO（任意）

  const [slots, setSlots] = useState<Slot[]>([
    { startAt: '', endAt: '' }
  ])
  const [participants, setParticipants] = useState<Participant[]>([
    { name: '', email: '', role: 'member' }
  ])

  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addSlot = () => setSlots(prev => [...prev, { startAt: '', endAt: '' }])
  const addParticipant = () => setParticipants(prev => [...prev, { name: '', email: '', role: 'member' }])

  const parseLocalToUTC = (local: string) => {
    // local: "2025-09-01T10:00"（ローカル）→ ISO UTC
    if (!local) return ''
    const d = new Date(local)
    return d.toISOString()
  }

  const create = async () => {
    setError(null); setResult(null)

    // 必須チェック
    if (process.env.NEXT_PUBLIC_SITE_URL === undefined) {
      // なくても動きますが、警告として残すならこういう感じでもOK
    }
    if (!title) { setError('タイトルは必須です'); return }
    const body = {
      title,
      description: description || undefined,
      durationMin,
      timezone,
      deadlineAt: deadlineAt ? new Date(deadlineAt).toISOString() : undefined,
      slots: slots
        .filter(s => s.startAt && s.endAt)
        .map(s => ({ startAt: new Date(s.startAt).toISOString(), endAt: new Date(s.endAt).toISOString() })),
      participants: participants
        .filter(p => (p.name || p.email))
        .map(p => ({ name: p.name || undefined, email: p.email || undefined, role: p.role }))
    }
    if (body.slots.length === 0) { setError('候補日時を1件以上入力してください'); return }
    if (body.participants.length === 0) { setError('参加者を1名以上入力してください'); return }

    setLoading(true)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (adminKey) headers['x-admin-key'] = adminKey  // PUBLIC_CREATE=false のときに必要

      const res = await fetch('/api/events/create', {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      })

      const ct = res.headers.get('content-type') || ''
      let data: any = null
      let text = ''
      try {
        if (ct.includes('application/json')) {
          data = await res.json()
        } else {
          text = await res.text()
        }
      } catch {
        // 本当に空ボディでも落ちないように握りつぶす
      }

      if (!res.ok) {
        const msg = (data && data.error) || text || `HTTP ${res.status}`
        throw new Error(msg)
      }

      setResult(data)  // { event, slots, participants, invites, organizerKey }
    } catch (e: any) {
      setError(e.message || '作成に失敗しました')
    } finally {
      setLoading(false)
    }
  }


  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || ''

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <h1>幹事用：イベント作成</h1>
      <p style={{ color: '#666' }}>※ MVPの簡易画面です。<b>ADMIN_SECRET</b> を入力して作成します。第三者に共有しないでください。</p>

      <section style={{ border: '1px solid #ddd', padding: 16, borderRadius: 8, marginTop: 16 }}>
        <h2>1) 管理キー</h2>
        <input type="password" placeholder="ADMIN_SECRET" value={adminKey} onChange={e => setAdminKey(e.target.value)} style={{ width: '100%', padding: 8 }} />
      </section>

      <section style={{ border: '1px solid #ddd', padding: 16, borderRadius: 8, marginTop: 16 }}>
        <h2>2) イベント情報</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label>タイトル</label>
            <input value={title} onChange={e => setTitle(e.target.value)} style={{ width: '100%', padding: 8 }} />
          </div>
          <div>
            <label>所要（分）</label>
            <input type="number" value={durationMin} onChange={e => setDurationMin(parseInt(e.target.value || '60'))} style={{ width: '100%', padding: 8 }} />
          </div>
          <div>
            <label>タイムゾーン</label>
            <input value={timezone} onChange={e => setTimezone(e.target.value)} style={{ width: '100%', padding: 8 }} />
          </div>
          <div>
            <label>回答期限（任意）</label>
            <input type="datetime-local" value={deadlineAt} onChange={e => setDeadlineAt(e.target.value)} style={{ width: '100%', padding: 8 }} />
          </div>
        </div>
        <div style={{ marginTop: 8 }}>
          <label>説明（任意）</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} style={{ width: '100%', padding: 8 }} />
        </div>
      </section>

      <section style={{ border: '1px solid #ddd', padding: 16, borderRadius: 8, marginTop: 16 }}>
        <h2>3) 候補日時</h2>
        {slots.map((s, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
            <input type="datetime-local" value={s.startAt} onChange={e => {
              const v = e.target.value; setSlots(prev => prev.map((x, idx) => idx === i ? { ...x, startAt: v } : x))
            }} />
            <input type="datetime-local" value={s.endAt} onChange={e => {
              const v = e.target.value; setSlots(prev => prev.map((x, idx) => idx === i ? { ...x, endAt: v } : x))
            }} />
          </div>
        ))}
        <button onClick={addSlot}>＋ 候補を追加</button>
      </section>

      <section style={{ border: '1px solid #ddd', padding: 16, borderRadius: 8, marginTop: 16 }}>
        <h2>4) 参加者</h2>
        {participants.map((p, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 160px', gap: 12, marginBottom: 8 }}>
            <input placeholder="氏名（任意）" value={p.name || ''} onChange={e => {
              const v = e.target.value; setParticipants(prev => prev.map((x, idx) => idx === i ? { ...x, name: v } : x))
            }} />
            <input placeholder="メール（任意）" value={p.email || ''} onChange={e => {
              const v = e.target.value; setParticipants(prev => prev.map((x, idx) => idx === i ? { ...x, email: v } : x))
            }} />
            <select value={p.role} onChange={e => {
              const v = e.target.value as Participant['role']; setParticipants(prev => prev.map((x, idx) => idx === i ? { ...x, role: v } : x))
            }}>
              <option value="must">必須参加（must）</option>
              <option value="member">通常（member）</option>
              <option value="optional">任意（optional）</option>
            </select>
          </div>
        ))}
        <button onClick={addParticipant}>＋ 参加者を追加</button>
      </section>

      <div style={{ marginTop: 16 }}>
        <button onClick={create} disabled={loading} style={{ padding: '10px 16px', fontWeight: 600 }}>
          {loading ? '作成中…' : 'イベント作成'}
        </button>
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
      </div>

      {result && (
        <section style={{ border: '1px solid #4caf50', padding: 16, borderRadius: 8, marginTop: 16 }}>
          <h2>作成完了 🎉</h2>
          <p>参加用リンク（配布してください）:</p>
          <ul>
            {result.invites?.map((inv: any, idx: number) => (
              <li key={idx}>
                {inv.name || inv.email || `参加者${idx + 1}`}：{' '}
                <a href={inv.url} target="_blank" rel="noreferrer">{inv.url}</a>
              </li>
            ))}
          </ul>
          <p>イベントページ（自分で確認用）:</p>
          <p><a href={`${baseUrl}/event/${result.event?.id}`} target="_blank" rel="noreferrer">
            {baseUrl}/event/{result.event?.id}
          </a>（※参加には招待トークン付きURLが必要）</p>
        </section>
      )}
    </main>
  )
}
