#!/usr/bin/env tsx
import { readFileSync } from "node:fs";
import { loadEnv } from "./lib/load-env";
import { relayWebhooks } from "./lib/relay-webhooks";

loadEnv();

async function main(): Promise<void> {
  let url = process.argv[2]?.trim();
  if (!url) {
    const stdin = readFileSync(0, "utf8").trim();
    url = stdin.split(/\s+/)[0];
  }
  if (!url || !/^https?:\/\//i.test(url)) {
    console.error("使い方: tsx send-url.ts <投稿のURL>");
    process.exit(1);
  }
  await relayWebhooks(url);
  console.log("送信しました:", url);
}

main().catch((e: Error) => {
  console.error(e.message || e);
  process.exit(1);
});
