# X → Slack / Discord（times 用 URL 通知）

自分の X 投稿の **URL**（または **本文＋URL**）を、Slack と Discord の **Webhook** に送るためのツールです。  
**ブラウザ UI**（ローカル）と **CLI** があります。

## リポジトリの取得

```bash
git clone https://github.com/tori-create-7991/x-times-relay.git
cd x-times-relay
```

## 無料で「簡易」にやる場合の現実

- **X の投稿をプログラムで読む API** は、現状 **無料枠だけでは読み取りができない** ことが多いです。
- **投稿だけ**は無料枠で使える場合があります（X Developer のプラン次第）。その場合は **`post-x.mjs` か Web UI** で「投稿 → 返ってきた ID で URL を組み立て → Webhook に送る」が **読み取り API なし**で動きます。
- 読み取りが使えないときの代替は、**手動で URL を渡す** `send-url.mjs`、または **ポーリング** `poll-x.mjs`（読み取り API が必要）。

## 準備（Slack / Discord）

### Slack（日本リージョンでも同じ）

1. ワークスペースで **Incoming Webhooks** を有効にする（または「着信 Webhooks」アプリをチャンネルに追加）。
2. 通知したいチャンネル（例: `#times`）用の **Webhook URL** をコピーする。

### Discord

1. サーバー → チャンネル（例: `#times`）→ **チャンネルを編集** → **連携サービス** → **ウェブフック** → 新しいウェブフック。
2. **Webhook URL** をコピーする。

## セットアップ

```bash
cp env.example .env
# .env を編集（Webhook は必須。X に API 投稿するなら OAuth キーも）
```

Node.js 18 以上（`fetch` 利用）。

### X に API で投稿する場合の `.env`

`env.example` のとおり、次を設定します（X Developer Portal でアプリ作成・ユーザー認証）。

- `X_API_KEY` / `X_API_SECRET` / `X_ACCESS_TOKEN` / `X_ACCESS_TOKEN_SECRET`
- `X_USERNAME` … 投稿 URL 用（`@` なし）

## Web UI（ローカル）

```bash
npm run ui
# ブラウザで http://127.0.0.1:3847/ を開く
```

- **既定で `127.0.0.1` のみ**（LAN からは開けません）。変えたい場合は `RELAY_UI_HOST` / `RELAY_UI_PORT`。
- ブラウザから他人に使われたくない場合は **`RELAY_UI_USER` と `RELAY_UI_PASSWORD`** を設定すると Basic 認証がかかります。

## CLI: X に投稿して Slack / Discord へ

```bash
node post-x.mjs "いまの気持ち"
# 本文も Slack/Discord に送りたいとき
node post-x.mjs --body "いまの気持ち"
```

## 使い方（手動で URL だけ飛ばす）

投稿した X の URL をコピーして:

```bash
node send-url.mjs "https://x.com/yourname/status/1234567890"
```

標準入力でも可:

```bash
echo "https://x.com/yourname/status/1234567890" | node send-url.mjs
```

同じ URL が **Slack と Discord の両方**に送られます（どちらかの URL だけ設定すれば、その一方だけにも送れます）。

## 自動ポーリング（読み取り API が使える場合のみ）

X Developer Portal で **読み取り可能な** Bearer トークンと、数値の **ユーザー ID** が取れる場合:

`.env` に追加:

```env
X_BEARER_TOKEN=...
X_USER_ID=1234567890123456789
X_USERNAME=yourname
```

初回は「最新 ID だけ記録」し、**それ以降の新規投稿**から通知します。

```bash
node poll-x.mjs
```

定期実行はローカルの cron や GitHub Actions などに任せてください（シークレットはリポジトリに置かないこと）。

## ソース管理について

- このディレクトリのスクリプトは **コミットして問題ありません**。
- **`.env` と `data/` は `.gitignore` 済み**です。Webhook URL やトークンは絶対に push しないでください。

## トラブルシュート

| 症状 | 確認 |
|------|------|
| Slack に来ない | Webhook URL がそのチャンネル用か、アプリがチャンネルに入っているか |
| Discord に来ない | Webhook がそのチャンネル用か、URL が有効か |
| `poll-x` が 403/401 | 無料枠では読み取り不可の可能性。手動 `send-url` 運用へ |
