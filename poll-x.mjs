#!/usr/bin/env node
/**
 * X API v2 で自分の最新投稿をポーリングし、新しい分だけ Webhook に送る。
 * 読み取り API は無料枠では使えないことが多いです（要: 有料プラン等）。
 *
 * Usage: node poll-x.mjs
 * 環境変数: X_BEARER_TOKEN, X_USER_ID, SLACK_WEBHOOK_URL, DISCORD_WEBHOOK_URL
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./lib/load-env.mjs";
import { relayWebhooks } from "./lib/relay-webhooks.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

loadEnv();

const STATE_DIR = join(__dirname, "data");
const STATE_FILE = join(STATE_DIR, "last-tweet-id.json");

function loadLastId() {
  if (!existsSync(STATE_FILE)) return null;
  try {
    const j = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    return j.lastTweetId ?? null;
  } catch {
    return null;
  }
}

function saveLastId(id) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify({ lastTweetId: id }, null, 2));
}

async function fetchRecentTweets(bearer, userId) {
  const u = new URL(`https://api.twitter.com/2/users/${userId}/tweets`);
  u.searchParams.set("max_results", "5");
  u.searchParams.set("tweet.fields", "created_at");
  const res = await fetch(u, {
    headers: { Authorization: `Bearer ${bearer}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      data.detail || data.title || data.errors?.[0]?.message || JSON.stringify(data)
    );
  }
  return data.data ?? [];
}

async function relayUrl(url) {
  await relayWebhooks(url);
}

async function main() {
  const bearer = process.env.X_BEARER_TOKEN;
  const userId = process.env.X_USER_ID;
  if (!bearer || !userId) {
    console.error(
      "X_BEARER_TOKEN と X_USER_ID を .env に設定してください。\n" +
        "（無料の X API では読み取りができない場合があります）"
    );
    process.exit(1);
  }

  const tweets = await fetchRecentTweets(bearer, userId);
  if (tweets.length === 0) {
    console.log("取得できる投稿がありません（初回は次の投稿から検知されます）。");
    return;
  }

  const username = process.env.X_USERNAME;
  const lastId = loadLastId();

  const sorted = [...tweets].sort((a, b) =>
    BigInt(a.id) < BigInt(b.id) ? -1 : 1
  );

  if (!lastId) {
    const newest = sorted[sorted.length - 1];
    saveLastId(newest.id);
    console.log(
      "初回実行: 最新IDを記録しました。過去分は送りません:",
      newest.id
    );
    return;
  }

  const lastBig = BigInt(lastId);
  const newOnes = sorted.filter((t) => BigInt(t.id) > lastBig);
  if (newOnes.length === 0) {
    console.log("新しい投稿はありません。");
    return;
  }

  if (!username) {
    console.error(
      "初回以降の通知には投稿URLに必要な X_USERNAME（@なしのユーザー名）を .env に追加してください。"
    );
    process.exit(1);
  }

  for (const t of newOnes) {
    const url = `https://x.com/${username}/status/${t.id}`;
    await relayUrl(url);
    console.log("送信:", url);
  }
  saveLastId(newOnes[newOnes.length - 1].id);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
