import { postTweet, tweetPermalink } from "./post-x";
import { postBluesky } from "./post-bluesky";
import { postThreads } from "./post-threads";
import { relayWebhooks } from "./relay-webhooks";
import { appendHistory } from "./history";
import type { PostAllResult, PlatformResult } from "./types";

export async function postAll(
  text: string,
  { shareBody = false }: { shareBody?: boolean } = {}
): Promise<PostAllResult> {
  const username = process.env.X_USERNAME?.trim();

  const [xResult, bskyResult, threadsResult] = await Promise.all([
    // X
    (async (): Promise<PlatformResult> => {
      if (!process.env.X_API_KEY) return null;
      try {
        if (!username) throw new Error("X_USERNAME を .env に設定してください。");
        const id = await postTweet(text);
        const url = tweetPermalink(username, id);
        return { url, ok: true };
      } catch (e) {
        return { url: null, ok: false, error: (e as Error).message };
      }
    })(),
    // Bluesky
    (async (): Promise<PlatformResult> => {
      try {
        const result = await postBluesky(text);
        if (!result) return null;
        return { ...result, ok: true };
      } catch (e) {
        return { url: null, ok: false, error: (e as Error).message };
      }
    })(),
    // Threads
    (async (): Promise<PlatformResult> => {
      try {
        const result = await postThreads(text);
        if (!result) return null;
        return { ...result, ok: true };
      } catch (e) {
        return { url: null, ok: false, error: (e as Error).message };
      }
    })(),
  ]);

  // Slack/Discord へは X の URL のみ中継
  if (xResult?.ok && xResult.url) {
    const relayText = shareBody ? `${text}\n${xResult.url}` : xResult.url;
    try {
      await relayWebhooks(relayText);
    } catch (e) {
      console.error("Webhook relay error:", (e as Error).message);
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
