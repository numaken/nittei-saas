import Link from 'next/link'

export default function Home() {
  return (
    <main style={{padding: 24, maxWidth: 800, margin: '0 auto'}}>
      <h1>日程調整くん SaaS (MVP)</h1>
      <p>この画面はデモです。イベント作成は API から実行してください。</p>
      <ul>
        <li><code>POST /api/events/create</code> でイベント作成</li>
        <li>参加者リンク: <code>/event/[id]?t=INVITE_TOKEN</code></li>
      </ul>
      <p><Link href="https://github.com/">README を参照してセットアップ</Link></p>
    </main>
  )
}
