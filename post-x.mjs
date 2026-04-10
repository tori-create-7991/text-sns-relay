#!/usr/bin/env node
/**
 * CLI: X に投稿し、Slack / Discord に共有
 * Usage: node post-x.mjs "本文"
 *    or: node post-x.mjs --body   "本文"   （本文+URL を Slack/Discord に送る）
 */

import { readFileSync } from "node:fs";
import { loadEnv } from "./lib/load-env.mjs";
import { postTweetAndRelay } from "./lib/post-x.mjs";

loadEnv();

async function main() {
  const args = process.argv.slice(2);
  let shareBody = false;
  const rest = [];
  for (const a of args) {
    if (a === "--body" || a === "-b") shareBody = true;
    else rest.push(a);
  }
  let text = rest.join(" ").trim();
  if (!text) {
    text = readFileSync(0, "utf8").trim();
  }
  if (!text) {
    console.error(
      "使い方: node post-x.mjs [--body] \"投稿本文\"\n" +
        "  --body … Slack/Discord に本文と URL の両方を送る"
    );
    process.exit(1);
  }

  const { url } = await postTweetAndRelay({ text, shareBody });
  console.log("投稿しました:", url);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
