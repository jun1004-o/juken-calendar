# LINE通知の初回設定

GitHub Issueを永続的な判断履歴とし、Founderが対応すべき通知だけをLINEへ転送します。通常運転・変更なし・軽微な内部作業は送信しません。

## 一度だけ行う設定

1. LINE Official Accountを作成する。
2. LINE DevelopersでMessaging APIを有効化する。
3. FounderがそのOfficial Accountを友だち追加する。
4. LINE Developers ConsoleでチャネルアクセストークンとDeveloperのLINE user IDを確認する。
5. GitHubリポジトリの `Settings > Secrets and variables > Actions` に以下を暗号化Secretとして登録する。
   - `LINE_CHANNEL_ACCESS_TOKEN`
   - `LINE_USER_ID`
6. Actionsの「LINE governance notification」を手動実行し、固定された非機密の接続テストを受信する。

値をIssue、コード、ログ、チャットへ貼り付けないでください。有料プラン、追加の受信者、通知対象の拡大はFounderの別承認が必要です。

## 通知契約

次のタイトルで、リポジトリ所有者 `jun1004-o` が作成したIssueだけを送ります。

- `[稟議]`: Founder判断が必要
- `[重大通知]`: 重大障害・品質・セキュリティ・コスト・継続リスク
- `[経営報告]`: 重要な進捗、日程変更、重大な機会、週次・月次報告

Issue本文は公開データとして扱い、機密情報や個人情報を書きません。ワークフローは本文を要約し、代表的なSecret形式を伏せ、LINEの文字数上限内へUnicode単位で切り詰めます。

## 脅威と制御

- Issue本文は信頼しない。シェルコードへ展開せず、GitHubイベントJSONをNode.jsで読み取る。
- Issue作成者と実行者を両方とも所有者に限定する。
- Pull Request由来のIssueイベントは拒否する。
- Secretがなければ送信せず、安全なエラーだけを出す。
- Actions権限は `contents: read` と `issues: read` のみにする。
