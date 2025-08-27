import { useState } from 'react'

type SlotInput = { startAt: string; endAt: string }
type ParticipantInput = { name?: string; email?: string; role: 'must' | 'member' | 'optional' }

export default function NewEventPage() {
  const [title, setTitle] = useState('')
  const [duration, setDuration] = useState(60)
  const [slots, setSlots] = useState<SlotInput[]>([{ startAt: '', endAt: '' }])
  const [parts, setParts] = useState<ParticipantInput[]>([{ name: '', role: 'must' }])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function addSlot() { setSlots(s => [...s, { startAt: '', endAt: '' }]) }
  function addPart() { setParts(p => [...p, { name: '', role: 'member' }]) }

  async function submit() {
    setErr(null); setLoading(true)
    try {
      const payload = {
        title,
        durationMin: Number(duration),
        timezone: 'Asia/Tokyo',
        slots: slots
          .filter(s => s.startAt && s.endAt)
          .map(s => ({
            startAt: new Date(s.startAt).toISOString(),
            endAt: new Date(s.endAt).toISOString(),
          })),
        participants: parts.map(p => ({ name: p.name || undefined, email: p.email || undefined, role: p.role }))
      }
      const res = await fetch('/api/events/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)

      const eventId = json.event.id as string
      const organizerKey = json.organizerKey as string | undefined

      if (organizerKey) {
        // 保存（以後は自動入力に使う）
        localStorage.setItem('organizer-or-admin-key', organizerKey)
        localStorage.setItem(`organizer-key:${eventId}`, organizerKey)
        // コピー（失敗しても無視）
        try { await navigator.clipboard.writeText(organizerKey) } catch { }
        alert(`管理キー（organizerKey）をコピーしました。\n共同幹事にのみ共有してください。\n\n${organizerKey}`)
        // 鍵付きハッシュで遷移 → 直後に画面側でURLから鍵を消す
        location.href = `/organizer/${eventId}#k=${encodeURIComponent(organizerKey)}`
      } else {
        // もしDB側で未設定だった場合でもダッシュボードへ
        location.href = `/organizer/${eventId}`
      }
    } catch (e: any) {
      setErr(e.message || '作成に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 920, margin: '24px auto', padding: '0 16px', lineHeight: 1.6 }}>
      <h1>イベント作成（MVP）</h1>

      <label>タイトル</label>
      <input value={title} onChange={e => setTitle(e.target.value)} style={{ display: 'block', width: '100%', padding: 8, margin: '6px 0 12px', border: '1px solid #ddd', borderRadius: 6 }} />

      <label>所要時間（分）</label>
      <input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} style={{ display: 'block', width: 160, padding: 8, margin: '6px 0 12px', border: '1px solid #ddd', borderRadius: 6 }} />

      <h3>候補日時</h3>
      {slots.map((s, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input type="datetime-local" value={s.startAt} onChange={e => setSlots(arr => { const c = [...arr]; c[i] = { ...c[i], startAt: e.target.value }; return c })} />
          <input type="datetime-local" value={s.endAt} onChange={e => setSlots(arr => { const c = [...arr]; c[i] = { ...c[i], endAt: e.target.value }; return c })} />
        </div>
      ))}
      <button onClick={addSlot} style={{ marginBottom: 16 }}>＋ 候補を追加</button>

      <h3>参加者</h3>
      {parts.map((p, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input placeholder="名前（任意）" value={p.name || ''} onChange={e => setParts(arr => { const c = [...arr]; c[i] = { ...c[i], name: e.target.value }; return c })} />
          <select value={p.role} onChange={e => setParts(arr => { const c = [...arr]; c[i] = { ...c[i], role: e.target.value as any }; return c })}>
            <option value="must">必須</option>
            <option value="member">通常</option>
            <option value="optional">任意</option>
          </select>
        </div>
      ))}
      <button onClick={addPart} style={{ marginBottom: 16 }}>＋ 参加者を追加</button>

      {err && <p style={{ color: '#d00' }}>⚠️ {err}</p>}
      <button onClick={submit} disabled={loading} style={{ padding: '10px 14px' }}>作成する</button>

      <p style={{ marginTop: 12, color: '#666', fontSize: 13 }}>
        作成直後に、このイベント専用の <b>organizerKey</b> を表示・コピーし、幹事画面へ自動遷移します。<br />
        ※ <b>ADMIN_SECRET</b> は運営専用で、一般ユーザーは不要です。
      </p>
    </div>
  )
}
