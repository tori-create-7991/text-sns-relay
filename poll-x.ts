#!/usr/bin/env tsx
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./lib/load-env";
import { relayWebhooks } from "./lib/relay-webhooks";

const __dirname = dirname(fileURLToPath(import.meta.url));

loadEnv();

const STATE_DIR = join(__dirname, "data");
const STATE_FILE = join(STATE_DIR, "last-tweet-id.json");

function loadLastId(): string | null {
  if (!existsSync(STATE_FILE)) return null;
  try {
    const j = JSON.parse(readFileSync(STATE_FILE, "utf8")) as { lastTweetId?: string };
    return j.lastTweetId ?? null;
  } catch {
    return null;
  }
}

function saveLastId(id: string): void {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify({ lastTweetId: id }, null, 2));
}

interface Tweet {
  id: string;
  text: string;
  created_at?: string;
}

async function fetchRecentTweets(bearer: string, userId: string): Promise<Tweet[]> {
  const u = new URL(`https://api.twitter.com/2/users/${userId}/tweets`);
  u.searchParams.set("max_results", "5");
  u.searchParams.set("tweet.fields", "created_at");
  const res = await fetch(u, {
    headers: { Authorization: `Bearer ${bearer}` },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as any;
  if (!res.ok) {
    throw new Error(
      data.detail || data.title || data.errors?.[0]?.message || JSON.stringify(data)
    );
  }
  return (data.data ?? []) as Tweet[];
}

async function main(): Promise<void> {
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
    await relayWebhooks(url);
    console.log("送信:", url);
  }
  saveLastId(newOnes[newOnes.length - 1].id);
}

main().catch((e: Error) => {
  console.error(e.message || e);
  process.exit(1);
});
