# 受験日程カレンダー MVP

中学受験家庭の情報収集負担を減らす、モバイル優先の静的PWAです。7校の公式情報をGit管理し、確認済み日程だけを横断表示してRFC 5545 ICSとして書き出します。ログイン、サーバー、個人情報保存、有料サービス、実行時LLMはありません。

## ローカル開発

Node.js 22以上を使用します。

```bash
npm ci
npm run dev
```

品質確認は `npm run check`、375pxの実ブラウザ確認は初回に `npx playwright install chromium` を実行してから `npm run test:e2e` です。

## データの追加と監査

正本は `data/collection-state.json`、イベント仕様は `data/event.schema.json` です。

1. School Data Agentが一次情報を確認し、必須メタデータを持つ `candidate` を追加する。
2. Data Auditor Agentが元情報、年度、日時、対象学年、申込期間、重複、矛盾を独立確認する。
3. 確認完了時だけ `status: verified` と `verified_at` を設定する。
4. `npm run generate:data` を実行する。
5. `npm run check` を通す。

生成処理は `verified` かつ `verified_at` のあるイベントだけを `public/data/events.json` へ出力します。候補・隔離データは公開成果物に入りません。

## カレンダー連携

画面の「カレンダーに追加」で、選択中の学校・絞り込み条件に一致する確認済みイベントを `.ics` として保存します。Googleカレンダーでは「設定 > インポート/エクスポート」から読み込めます。直接OAuth連携はMVPの対象外です。

## ゼロコスト公開

`npm run build` の `dist/` は静的ファイルだけです。GitHub Pages、Cloudflare Pagesなどの無料枠へ配置できます。公開先を追加するときも、有料プランを有効にしないでください。

## LINE運営通知

セットアップと安全設計は [docs/line-setup.md](docs/line-setup.md) を参照してください。GitHub Issueを監査可能な記録として残し、指定プレフィックスの重要通知だけをLINE Messaging APIへ転送します。

## 既知の制約

- 現在の確認済み公開日程は東葛飾中学校の6件です。残り44件は独立監査待ちです。
- ICSは一方向のスナップショットです。更新時は再インポートが必要です。
- ブラウザ通知、ログイン、Google Calendar API、全国展開はMVPに含みません。
