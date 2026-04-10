/**
 * X API v2 に OAuth 1.0a で投稿し、Slack / Discord に URL（または本文+URL）を送る
 */

import { oauth1AuthorizationHeader } from "./oauth1a.mjs";
import { relayWebhooks } from "./relay-webhooks.mjs";

const TWEETS_ENDPOINT = "https://api.twitter.com/2/tweets";

/**
 * @param {string} text 投稿本文（長さは X の制限に従う）
 * @returns {Promise<string>} ツイート ID
 */
export async function postTweet(text) {
  const consumerKey = process.env.X_API_KEY;
  const consumerSecret = process.env.X_API_SECRET;
  const token = process.env.X_ACCESS_TOKEN;
  const tokenSecret = process.env.X_ACCESS_TOKEN_SECRET;
  if (!consumerKey || !consumerSecret || !token || !tokenSecret) {
    throw new Error(
      "X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET を .env に設定してください。"
    );
  }

  const auth = oauth1AuthorizationHeader({
    method: "POST",
    url: TWEETS_ENDPOINT,
    consumerKey,
    consumerSecret,
    token,
    tokenSecret,
  });

  const res = await fetch(TWEETS_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg =
      data.detail ||
      data.title ||
      data.errors?.[0]?.message ||
      JSON.stringify(data);
    throw new Error(msg);
  }
  const id = data.data?.id;
  if (!id) throw new Error("レスポンスにツイート ID がありません。");
  return id;
}

export function tweetPermalink(username, tweetId) {
  return `https://x.com/${username}/status/${tweetId}`;
}

/**
 * @param {object} o
 * @param {string} o.text 投稿本文
 * @param {boolean} [o.shareBody] true のとき Slack/Discord に「本文 + 改行 + URL」
 * @returns {Promise<{ id: string, url: string }>}
 */
export async function postTweetAndRelay({ text, shareBody = false }) {
  const username = process.env.X_USERNAME?.trim();
  if (!username) {
    throw new Error("投稿 URL を組み立てるため X_USERNAME（@なし）を .env に設定してください。");
  }

  const id = await postTweet(text);
  const url = tweetPermalink(username, id);
  const relayText = shareBody ? `${text}\n${url}` : url;
  await relayWebhooks(relayText);
  return { id, url };
}
