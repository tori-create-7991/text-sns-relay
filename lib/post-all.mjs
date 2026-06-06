/**
 * X・Bluesky・Threads への並列同時投稿 + 履歴保存
 * 各プラットフォームが未設定またはエラーでも処理を止めない
 * Slack/Discord への中継は X の URL のみ（現状維持）
 */

import { postTweet, tweetPermalink } from "./post-x.mjs";
import { postBluesky } from "./post-bluesky.mjs";
import { postThreads } from "./post-threads.mjs";
import { relayWebhooks } from "./relay-webhooks.mjs";
import { appendHistory } from "./history.mjs";

/**
 * @param {string} text 投稿本文
 * @param {{ shareBody?: boolean }} [opts]
 * @returns {Promise<{ x: object|null, bluesky: object|null, threads: object|null }>}
 */
export async function postAll(text, { shareBody = false } = {}) {
  const username = process.env.X_USERNAME?.trim();

  const [xResult, bskyResult, threadsResult] = await Promise.all([
    // X
    (async () => {
      if (!process.env.X_API_KEY) return null;
      try {
        if (!username) throw new Error("X_USERNAME を .env に設定してください。");
        const id = await postTweet(text);
        const url = tweetPermalink(username, id);
        return { url, ok: true };
      } catch (e) {
        return { url: null, ok: false, error: e.message };
      }
    })(),
    // Bluesky
    (async () => {
      try {
        const result = await postBluesky(text);
        if (!result) return null;
        return { ...result, ok: true };
      } catch (e) {
        return { url: null, ok: false, error: e.message };
      }
    })(),
    // Threads
    (async () => {
      try {
        const result = await postThreads(text);
        if (!result) return null;
        return { ...result, ok: true };
      } catch (e) {
        return { url: null, ok: false, error: e.message };
      }
    })(),
  ]);

  // Slack/Discord へは X の URL のみ中継
  if (xResult?.ok && xResult.url) {
    const relayText = shareBody ? `${text}\n${xResult.url}` : xResult.url;
    try {
      await relayWebhooks(relayText);
    } catch (e) {
      console.error("Webhook relay error:", e.message);
    }
  }

  // 履歴保存
  appendHistory({
    sent_at: new Date().toISOString(),
    text,
    x: xResult,
    bluesky: bskyResult,
    threads: threadsResult,
  });

  return { x: xResult, bluesky: bskyResult, threads: threadsResult };
}
