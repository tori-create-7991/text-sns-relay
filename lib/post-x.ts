import { oauth1AuthorizationHeader } from "./oauth1a";

const TWEETS_ENDPOINT = "https://api.twitter.com/2/tweets";

export async function postTweet(text: string): Promise<string> {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as any;
  if (!res.ok) {
    const msg =
      data.detail ||
      data.title ||
      data.errors?.[0]?.message ||
      JSON.stringify(data);
    throw new Error(msg);
  }
  const id = data.data?.id as string | undefined;
  if (!id) throw new Error("レスポンスにツイート ID がありません。");
  return id;
}

export function tweetPermalink(username: string, tweetId: string): string {
  return `https://x.com/${username}/status/${tweetId}`;
}
