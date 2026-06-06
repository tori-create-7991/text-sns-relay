/**
 * Bluesky（AT Protocol）への投稿
 * 必要env: BSKY_HANDLE, BSKY_APP_PASSWORD
 */

const BSKY_API = "https://bsky.social/xrpc";

async function createSession(handle, appPassword) {
  const res = await fetch(`${BSKY_API}/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: handle, password: appPassword }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || JSON.stringify(data));
  }
  return { accessJwt: data.accessJwt, did: data.did };
}

/**
 * @param {string} text 投稿本文
 * @returns {Promise<{ url: string } | null>} 未設定なら null
 */
export async function postBluesky(text) {
  const handle = process.env.BSKY_HANDLE;
  const appPassword = process.env.BSKY_APP_PASSWORD;
  if (!handle || !appPassword) return null;

  const { accessJwt, did } = await createSession(handle, appPassword);

  const res = await fetch(`${BSKY_API}/com.atproto.repo.createRecord`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessJwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      repo: did,
      collection: "app.bsky.feed.post",
      record: {
        $type: "app.bsky.feed.post",
        text,
        createdAt: new Date().toISOString(),
      },
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || JSON.stringify(data));
  }

  // at://did/app.bsky.feed.post/rkey → rkey を取り出す
  const uri = data.uri;
  const rkey = uri.split("/").pop();
  const url = `https://bsky.app/profile/${handle}/post/${rkey}`;
  return { url };
}
