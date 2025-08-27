import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'

export default function Landing() {
  const router = useRouter()
  const [creatingDemo, setCreatingDemo] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // 1クリックでデモ用イベントを作成して幹事画面へ遷移
  async function createDemo() {
    try {
      setErr(null)
      setCreatingDemo(true)

      // ちょい未来の候補を2枠作成（JST想定だがUTCに正規化して送る）
      const now = new Date()
      const s1 = new Date(now)
      s1.setDate(s1.getDate() + 1)
      s1.setHours(19, 0, 0, 0)
      const e1 = new Date(s1)
      e1.setHours(e1.getHours() + 1)

      const s2 = new Date(now)
      s2.setDate(s2.getDate() + 2)
      s2.setHours(19, 0, 0, 0)
      const e2 = new Date(s2)
      e2.setHours(e2.getHours() + 1)

      const payload = {
        title: '（デモ）みんなで日程調整',
        description: 'このイベントはデモ用に自動作成されました。',
        durationMin: 60,
        timezone: 'Asia/Tokyo',
        slots: [
          { startAt: s1.toISOString(), endAt: e1.toISOString() },
          { startAt: s2.toISOString(), endAt: e2.toISOString() },
        ],
        participants: [
          { name: 'あなた', role: 'must' },
          { name: 'Aさん', role: 'member' },
          { name: 'Bさん', role: 'optional' },
        ],
      }

      const res = await fetch('/api/events/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)

      const eventId: string = json.event.id
      const organizerKey: string | undefined = json.organizerKey

      // 参加者として試したい場合は、↓のURLに遷移でもOK
      // const firstInviteUrl: string = json.invites?.[0]?.url

      // 幹事としてダッシュボードへ（鍵はハッシュで渡し、画面側で保存＆URLから消去）
      if (organizerKey) {
        try { await navigator.clipboard.writeText(organizerKey) } catch { }
        localStorage.setItem('organizer-or-admin-key', organizerKey)
        localStorage.setItem(`organizer-key:${eventId}`, organizerKey)
        router.push(`/organizer/${eventId}#k=${encodeURIComponent(organizerKey)}`)
      } else {
        router.push(`/organizer/${eventId}`)
      }
    } catch (e: any) {
      setErr(e.message || 'デモの作成に失敗しました')
      setCreatingDemo(false)
    }
  }

  return (
    <>
      <Head>
        <title>日程調整くん — みんなの空きを一目で。すぐ決まる。</title>
        <meta name="description" content="複数人の空き・不可をまとめて集めて、幹事が最適な1枠を即決。ログイン不要、リンクを配るだけ。" />
        <meta property="og:title" content="日程調整くん" />
        <meta property="og:description" content="複数人の空き・不可をまとめて集めて、幹事が最適な1枠を即決。ログイン不要、リンクを配るだけ。" />
        <meta property="og:type" content="website" />
      </Head>

      {/* ヘッダー */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        maxWidth: 1100, margin: '16px auto', padding: '0 16px'
      }}>
        <div style={{ fontWeight: 700 }}>🗓️ 日程調整くん</div>
        <nav style={{ display: 'flex', gap: 14 }}>
          <a href="#how">使い方</a>
          <a href="#features">機能</a>
          <a href="#faq">FAQ</a>
          <Link href="/organizer/new" style={{
            padding: '8px 12px', border: '1px solid #ddd', borderRadius: 8, textDecoration: 'none'
          }}>新規作成</Link>
        </nav>
      </header>

      {/* ヒーロー */}
      <section style={{
        background: 'linear-gradient(180deg,#fff, #f8fafc)',
        borderTop: '1px solid #f0f0f0', borderBottom: '1px solid #f0f0f0'
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '56px 16px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '40px', margin: '0 0 12px' }}>みんなの空き、<br />一目でわかる。すぐ決まる。</h1>
          <p style={{ color: '#555', margin: '0 0 24px' }}>
            URLを配るだけ。参加者は「◎/△/×」を押すだけ。<br />
            幹事はスコア順に候補を見て、ワンクリックで確定。
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Link href="/organizer/new" style={{
              background: '#111', color: '#fff', padding: '12px 18px', borderRadius: 8, textDecoration: 'none'
            }}>
              今すぐはじめる（無料）
            </Link>
            <button onClick={createDemo} disabled={creatingDemo} style={{
              background: '#fff', border: '1px solid #ddd', padding: '12px 18px', borderRadius: 8, cursor: 'pointer'
            }}>
              {creatingDemo ? 'デモ作成中…' : '1クリックでデモを見る'}
            </button>
          </div>
          {err && <p style={{ color: '#b00020', marginTop: 12 }}>⚠️ {err}</p>}
          <p style={{ fontSize: 12, color: '#777', marginTop: 10 }}>
            ログイン不要・ハンズオンなし。デモは自動で消える場合があります。
          </p>
        </div>
      </section>

      {/* 使い方 */}
      <section id="how" style={{ maxWidth: 1100, margin: '32px auto', padding: '0 16px' }}>
        <h2>使い方（3ステップ）</h2>
        <ol style={{ lineHeight: 1.9 }}>
          <li><b>イベントを作成</b>（<Link href="/organizer/new">ここ</Link>）</li>
          <li><b>配布URLを送る</b>（幹事画面の「参加リンクを取得」→クリップボードにコピー）</li>
          <li><b>投票が集まったら確定</b>（「この候補で確定」→ ICS を配布）</li>
        </ol>
        <p style={{ fontSize: 13, color: '#666' }}>
          ※ 幹事にはイベント専用の <b>organizerKey</b> が自動発行されます。共同幹事にのみ共有してください。<br />
          ※ サービス全体のマスター鍵 <b>ADMIN_SECRET</b> は運営用で、一般ユーザーは不要です。
        </p>
      </section>

      {/* 機能 */}
      <section id="features" style={{ maxWidth: 1100, margin: '32px auto', padding: '0 16px' }}>
        <h2>主な機能</h2>
        <ul style={{ lineHeight: 1.9 }}>
          <li>URLだけで投票（ログイン不要 / ◎△×）</li>
          <li>幹事ダッシュボード（参加リンクの一括コピー / 候補追加 / 1クリック確定）</li>
          <li>ICS配布で各自のカレンダーへ即登録</li>
          <li>イベント専用鍵（organizerKey）で“自分のイベントだけ”を管理</li>
        </ul>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ maxWidth: 1100, margin: '32px auto', padding: '0 16px' }}>
        <h2>FAQ</h2>
        <details style={{ marginBottom: 8 }}>
          <summary>参加者はアカウントが必要ですか？</summary>
          <div>不要です。配布URLから◎/△/×を押すだけで投票できます。</div>
        </details>
        <details style={{ marginBottom: 8 }}>
          <summary>幹事の権限はどうやって管理しますか？</summary>
          <div>イベント作成時に発行される <b>organizerKey</b> を知っている人だけが、そのイベントを管理できます。</div>
        </details>
        <details style={{ marginBottom: 8 }}>
          <summary>予定の確定後はどうなりますか？</summary>
          <div>幹事ダッシュボードから ICS をダウンロード・共有できます。参加者は各自のカレンダーに追加可能です。</div>
        </details>
      </section>

      {/* フッター */}
      <footer style={{ borderTop: '1px solid #eee', marginTop: 32 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px', display: 'flex', justifyContent: 'space-between' }}>
          <span>© {new Date().getFullYear()} 日程調整くん</span>
          <div style={{ display: 'flex', gap: 12 }}>
            <Link href="/organizer/new">新規作成</Link>
            <a href="#how">使い方</a>
            <a href="https://github.com/numaken/nittei-saas" target="_blank" rel="noreferrer">GitHub</a>
          </div>
        </div>
      </footer>
    </>
  )
}
