import { useMemo, useState } from 'react'
import { useRouter } from 'next/router'

// ===== ユーティリティ =====
function pad(n: number) { return String(n).padStart(2, '0') }
function ymd(date: Date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` }
function ymdLabel(date: Date) {
  const w = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()]
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}(${w})`
}
function toIsoLocal(dateStr: string, timeStr: string) {
  // dateStr: YYYY-MM-DD, timeStr: HH:mm
  const d = new Date(`${dateStr}T${timeStr}:00`)
  return d.toISOString() // サーバでISO想定のため
}
function daysInMonth(year: number, month0: number) {
  return new Date(year, month0 + 1, 0).getDate()
}
function startOfMonth(date: Date) { return new Date(date.getFullYear(), date.getMonth(), 1) }

// 30分刻みの時刻配列
const timeOptions = Array.from({ length: 48 }).map((_, i) => {
  const h = Math.floor(i / 2)
  const m = i % 2 === 0 ? '00' : '30'
  return `${pad(h)}:${m}`
})

// 所要時間（分）：30分刻みの候補（30〜240）
const durationOptions = Array.from({ length: 8 }).map((_, i) => (i + 1) * 30) // 30,60,...,240

type SlotInput = { startAtISO: string, endAtISO: string, label: string }
type ParticipantInput = { name?: string; email?: string; role: 'must' | 'member' | 'optional' }

export default function NewEventPage() {
  const router = useRouter()

  // 基本情報
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState<number>(60)
  const [timezone] = useState('Asia/Tokyo')

  // カレンダーの状態
  const [monthAnchor, setMonthAnchor] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d
  })
  const [pickedDate, setPickedDate] = useState<string>(() => ymd(new Date())) // YYYY-MM-DD
  const [startTime, setStartTime] = useState('19:00')
  const [endTime, setEndTime] = useState('20:00')

  // 追加した候補
  const [slots, setSlots] = useState<SlotInput[]>([])

  // 参加者
  const [parts, setParts] = useState<ParticipantInput[]>([{ name: '', role: 'must' }])

  // UX
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // カレンダー描画用計算
  const cal = useMemo(() => {
    const y = monthAnchor.getFullYear()
    const m0 = monthAnchor.getMonth()
    const first = startOfMonth(monthAnchor)
    const firstDow = first.getDay() // 0:日〜6:土
    const dim = daysInMonth(y, m0)
    // 6行×7列（最大）を埋める
    const cells: { d: Date; inMonth: boolean }[] = []
    // 前月埋め
    for (let i = 0; i < firstDow; i++) {
      const d = new Date(y, m0, -(firstDow - 1 - i))
      cells.push({ d, inMonth: false })
    }
    // 当月
    for (let day = 1; day <= dim; day++) {
      cells.push({ d: new Date(y, m0, day), inMonth: true })
    }
    // 次月埋め
    while (cells.length % 7 !== 0 || cells.length < 42) {
      const last = cells[cells.length - 1].d
      const d = new Date(last)
      d.setDate(last.getDate() + 1)
      cells.push({ d, inMonth: false })
      if (cells.length >= 42) break
    }
    return { y, m0, cells }
  }, [monthAnchor])

  function addSlotFromPicker() {
    setErr(null)
    if (!pickedDate || !startTime || !endTime) {
      setErr('日付と開始/終了時刻を選んでください')
      return
    }
    const sISO = toIsoLocal(pickedDate, startTime)
    const eISO = toIsoLocal(pickedDate, endTime)
    if (new Date(eISO).getTime() <= new Date(sISO).getTime()) {
      setErr('終了時刻は開始時刻より後にしてください')
      return
    }
    const label = `${ymdLabel(new Date(pickedDate))} ${startTime} 〜 ${endTime}`
    setSlots(prev => [...prev, { startAtISO: sISO, endAtISO: eISO, label }])
  }

  function removeSlot(idx: number) {
    setSlots(prev => prev.filter((_, i) => i !== idx))
  }

  function addPart() {
    setParts(p => [...p, { name: '', role: 'member' }])
  }
  function removePart(idx: number) {
    setParts(p => p.length > 1 ? p.filter((_, i) => i !== idx) : p)
  }

  async function submit() {
    setErr(null); setLoading(true)
    try {
      if (!title.trim()) throw new Error('タイトルを入力してください')
      if (slots.length === 0) throw new Error('候補日時を1件以上追加してください')

      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        durationMin: Number(duration),
        timezone,
        slots: slots.map((s, i) => ({ startAt: s.startAtISO, endAt: s.endAtISO })),
        participants: parts.map(p => ({
          name: p.name?.trim() || undefined,
          email: p.email?.trim() || undefined,
          role: p.role
        }))
      }

      const res = await fetch('/api/events/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)

      const eventId: string = json.event.id
      const organizerKey: string | undefined = json.organizerKey

      // organizerKey を保存 & コピ— & 遷移
      if (organizerKey) {
        try { await navigator.clipboard.writeText(organizerKey) } catch { }
        localStorage.setItem('organizer-or-admin-key', organizerKey)
        localStorage.setItem(`organizer-key:${eventId}`, organizerKey)
        alert(`管理キー（organizerKey）をコピーしました。\n共同幹事にのみ共有してください。\n\n${organizerKey}`)
        location.href = `/organizer/${eventId}#k=${encodeURIComponent(organizerKey)}`
      } else {
        location.href = `/organizer/${eventId}`
      }
    } catch (e: any) {
      setErr(e.message || '作成に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  // ===== UI =====
  return (
    <div style={{ maxWidth: 1100, margin: '24px auto', padding: '0 16px', lineHeight: 1.6 }}>
      <h1>イベント作成</h1>

      {/* 基本情報 */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 24 }}>
        <div>
          <label>タイトル</label>
          <input value={title} onChange={e => setTitle(e.target.value)}
            style={{ display: 'block', width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 6 }} />
        </div>
        <div>
          <label>説明（任意）</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            rows={3}
            style={{ display: 'block', width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 6 }} />
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div>
            <label>所要時間（分）</label>
            <select value={duration} onChange={e => setDuration(Number(e.target.value))}
              style={{ display: 'block', width: 180, padding: 10, border: '1px solid #ddd', borderRadius: 6 }}>
              {durationOptions.map(min => (
                <option key={min} value={min}>{min} 分</option>
              ))}
            </select>
          </div>
          <div>
            <label>タイムゾーン</label>
            <input value={timezone} readOnly
              style={{ display: 'block', width: 200, padding: 10, border: '1px solid #eee', borderRadius: 6, background: '#fafafa' }} />
          </div>
        </div>
      </section>

      {/* 候補日時：カレンダー＋30分刻み時刻選択 */}
      <section style={{ margin: '8px 0 24px' }}>
        <h2 style={{ marginBottom: 8 }}>候補日時</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* カレンダー */}
          <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <button onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() - 1, 1))}
                style={{ padding: '6px 10px' }}>← 前の月</button>
              <strong>{monthAnchor.getFullYear()}年 {monthAnchor.getMonth() + 1}月</strong>
              <button onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 1))}
                style={{ padding: '6px 10px' }}>次の月 →</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center', fontSize: 12, color: '#666', marginBottom: 4 }}>
              {['日', '月', '火', '水', '木', '金', '土'].map(d => <div key={d}>{d}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {cal.cells.map((c, idx) => {
                const isPicked = pickedDate === ymd(c.d)
                return (
                  <button key={idx}
                    onClick={() => { setPickedDate(ymd(c.d)) }}
                    style={{
                      border: '1px solid ' + (isPicked ? '#2b6cb0' : '#eee'),
                      background: isPicked ? '#2b6cb0' : (c.inMonth ? '#fff' : '#f8f9fb'),
                      color: isPicked ? '#fff' : (c.inMonth ? '#111' : '#9aa0a6'),
                      borderRadius: 6, padding: '10px 0', cursor: 'pointer'
                    }}>
                    {c.d.getDate()}
                  </button>
                )
              })}
            </div>
            <div style={{ marginTop: 8, color: '#666', fontSize: 13 }}>
              選択中の日付：<b>{ymdLabel(new Date(pickedDate))}</b>
            </div>
          </div>

          {/* 時刻ピッカー＆追加 */}
          <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <div>
                <label>開始</label>
                <select value={startTime} onChange={e => setStartTime(e.target.value)}
                  style={{ display: 'block', width: 140, padding: 10, border: '1px solid #ddd', borderRadius: 6 }}>
                  {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label>終了</label>
                <select value={endTime} onChange={e => setEndTime(e.target.value)}
                  style={{ display: 'block', width: 140, padding: 10, border: '1px solid #ddd', borderRadius: 6 }}>
                  {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <button onClick={addSlotFromPicker} style={{ padding: '10px 14px' }}>＋ この日時を候補に追加</button>

            <div style={{ marginTop: 14, fontSize: 13, color: '#666' }}>
              ※ 30分刻みで追加できます。必要なら複数枠を追加してください。
            </div>
          </div>
        </div>

        {/* 追加済み候補の一覧 */}
        <div style={{ marginTop: 16 }}>
          {slots.length === 0 ? (
            <p style={{ color: '#666' }}>候補がまだありません。カレンダーから追加してください。</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
              {slots.map((s, i) => (
                <li key={i} style={{ border: '1px solid #eee', borderRadius: 8, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontWeight: 600 }}>{s.label}</div>
                  <button onClick={() => removeSlot(i)} style={{ padding: '6px 10px' }}>削除</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* 参加者 */}
      <section style={{ margin: '8px 0 24px' }}>
        <h2 style={{ marginBottom: 8 }}>参加者</h2>
        {parts.map((p, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 140px 90px', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <input placeholder="名前（任意）" value={p.name || ''}
              onChange={e => setParts(arr => { const c = [...arr]; c[i] = { ...c[i], name: e.target.value }; return c })}
              style={{ padding: 10, border: '1px solid #ddd', borderRadius: 6 }} />
            <input placeholder="メール（任意）" value={p.email || ''}
              onChange={e => setParts(arr => { const c = [...arr]; c[i] = { ...c[i], email: e.target.value }; return c })}
              style={{ padding: 10, border: '1px solid #ddd', borderRadius: 6 }} />
            <select value={p.role} onChange={e => setParts(arr => { const c = [...arr]; c[i] = { ...c[i], role: e.target.value as any }; return c })}
              style={{ padding: 10, border: '1px solid #ddd', borderRadius: 6 }}>
              <option value="must">必須</option>
              <option value="member">通常</option>
              <option value="optional">任意</option>
            </select>
            <button onClick={() => removePart(i)} style={{ padding: '10px 8px' }} disabled={parts.length <= 1}>削除</button>
          </div>
        ))}
        <button onClick={addPart} style={{ padding: '10px 14px' }}>＋ 参加者を追加</button>
      </section>

      {/* エラー / 送信 */}
      {err && <p style={{ color: '#b00020' }}>⚠️ {err}</p>}
      <button onClick={submit} disabled={loading || slots.length === 0 || title.trim() === ''} style={{ padding: '12px 16px' }}>
        {loading ? '作成中…' : '作成する'}
      </button>

      <p style={{ marginTop: 12, color: '#666', fontSize: 13 }}>
        作成直後に、このイベント専用の <b>organizerKey</b> を表示・コピーし、幹事画面へ自動遷移します。<br />
        ※ <b>ADMIN_SECRET</b> は運営専用で、一般ユーザーは不要です。
      </p>
    </div>
  )
}
