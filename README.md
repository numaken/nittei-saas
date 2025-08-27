# 日程調整くん SaaS (MVP)

Next.js + Supabase で動く「候補日収集→可否→自動集計→確定→ICS配布」までの最小構成。

## セットアップ

1) Supabase プロジェクトを作成し、`SQL Editor` で `supabase/0001_init.sql` を実行。  
   RLS は有効化されています（クライアント直アクセスを防ぎ、API 経由で操作）。

2) `.env.example` を `.env.local` にコピーし、各値を設定。  
   - `ADMIN_SECRET`: 一時的な管理用キー（MVP のため）。
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` を Supabase から取得。

3) 依存関係をインストールして起動:
```bash
npm i
npm run dev
```

## API の使い方（MVP）

- **イベント作成**: `POST /api/events/create`
  - Header: `x-admin-key: <ADMIN_SECRET>`
  - Body JSON 例:
```json
{
  "title": "打合せ",
  "description": "キックオフ",
  "durationMin": 60,
  "timezone": "Asia/Tokyo",
  "deadlineAt": "2025-08-30T02:00:18.731173Z",
  "slots": [
    {"startAt":"2025-09-01T01:00:00Z","endAt":"2025-09-01T02:00:00Z"},
    {"startAt":"2025-09-01T03:00:00Z","endAt":"2025-09-01T04:00:00Z"}
  ],
  "participants": [
    {"name":"田中","email":"t@example.com","role":"must"},
    {"name":"鈴木","email":"s@example.com","role":"member"}
  ]
}
```

- **投票**: `POST /api/events/:id/vote?t=<invite_token>`
  - Body: `{"slotId":"<slot_uuid>","choice":"yes|maybe|no","comment":"任意"}`

- **集計**: `GET /api/events/:id/summary`

- **確定**: `POST /api/events/:id/decide`
  - Header: `x-admin-key: <ADMIN_SECRET>`
  - Body: `{"slotId":"<slot_uuid>"}`

- **ICS 取得**: `GET /api/events/:id/ics`

## 画面

- `/event/[id]?t=<invite_token>`: 参加者用の可否入力ページ（簡易 UI）。

> 本番運用では Supabase Auth / SSO 、通知（メール/Slack）、Stripe 課金を拡張してください。
