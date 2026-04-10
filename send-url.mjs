#!/usr/bin/env node
/**
 * X の投稿 URL を Slack と Discord の Webhook に送る（手動・他ツールから呼び出し用）
 * Usage: node send-url.mjs <url>
 *    or: echo "https://x.com/..." | node send-url.mjs
 */

import { readFileSync } from "node:fs";
import { loadEnv } from "./lib/load-env.mjs";
import { relayWebhooks } from "./lib/relay-webhooks.mjs";

loadEnv();

async function main() {
  let url = process.argv[2]?.trim();
  if (!url) {
    const stdin = readFileSync(0, "utf8").trim();
    url = stdin.split(/\s+/)[0];
  }
  if (!url || !/^https?:\/\//i.test(url)) {
    console.error("使い方: node send-url.mjs <投稿のURL>");
    process.exit(1);
  }
  await relayWebhooks(url);
  console.log("送信しました:", url);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
