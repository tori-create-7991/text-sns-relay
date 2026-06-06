#!/usr/bin/env node
/**
 * CLI: X / Bluesky / Threads に同時投稿し、Slack / Discord に X の URL を共有
 * Usage: node post-x.mjs "本文"
 *    or: node post-x.mjs --body   "本文"   （本文+URL を Slack/Discord に送る）
 */

import { readFileSync } from "node:fs";
import { loadEnv } from "./lib/load-env.mjs";
import { postAll } from "./lib/post-all.mjs";

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

  const result = await postAll(text, { shareBody });

  if (result.x?.ok) console.log("X:       ", result.x.url);
  if (result.x?.error) console.error("X エラー:", result.x.error);
  if (result.bluesky?.ok) console.log("Bluesky: ", result.bluesky.url);
  if (result.bluesky?.error) console.error("Bluesky エラー:", result.bluesky.error);
  if (result.threads?.ok) console.log("Threads: ", result.threads.url);
  if (result.threads?.error) console.error("Threads エラー:", result.threads.error);

  const anyOk = result.x?.ok || result.bluesky?.ok || result.threads?.ok;
  if (!anyOk) {
    console.error("いずれのプラットフォームにも投稿できませんでした。");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
