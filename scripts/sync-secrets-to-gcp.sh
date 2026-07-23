#!/usr/bin/env bash
# .env の値を GCP Secret Manager (tori-dev-secrets) へ同期する。
# 既存シークレットは新バージョンを追加、未作成なら新規作成する。
# 使い方: bash scripts/sync-secrets-to-gcp.sh
set -euo pipefail

PROJECT="${GCP_SECRETS_PROJECT:-tori-dev-secrets}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo ".env が見つかりません: $ENV_FILE" >&2
  exit 1
fi

# lib/load-env.ts の SECRET_KEYS と同じ一覧を維持すること
KEYS=(
  X_API_KEY
  X_API_SECRET
  X_ACCESS_TOKEN
  X_ACCESS_TOKEN_SECRET
  X_BEARER_TOKEN
  BSKY_HANDLE
  BSKY_APP_PASSWORD
  THREADS_ACCESS_TOKEN
  NOTION_TOKEN
  SLACK_WEBHOOK_URL
  DISCORD_WEBHOOK_URL
  RELAY_UI_PASSWORD
)

for key in "${KEYS[@]}"; do
  line="$(grep -E "^${key}=" "$ENV_FILE" | head -1 || true)"
  if [[ -z "$line" ]]; then
    echo "skip ${key}（.env に未設定）"
    continue
  fi
  value="${line#*=}"
  value="${value%\"}"; value="${value#\"}"
  value="${value%\'}"; value="${value#\'}"
  if [[ -z "$value" ]]; then
    echo "skip ${key}（値が空）"
    continue
  fi

  secret_name="text-sns-relay-$(echo "$key" | tr '[:upper:]' '[:lower:]' | tr '_' '-')"

  if gcloud secrets describe "$secret_name" --project="$PROJECT" >/dev/null 2>&1; then
    printf '%s' "$value" | gcloud secrets versions add "$secret_name" --project="$PROJECT" --data-file=-
    echo "updated ${secret_name}"
  else
    printf '%s' "$value" | gcloud secrets create "$secret_name" --project="$PROJECT" --data-file=- --replication-policy=automatic
    echo "created ${secret_name}"
  fi
done
