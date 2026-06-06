/**
 * Bluesky（AT Protocol）への投稿
 * 必要env: BSKY_HANDLE, BSKY_APP_PASSWORD
 */

const BSKY_API = "https://bsky.social/xrpc";

// セッションを90分間キャッシュして createSession のレート制限を回避
let _session = null;

async function getSession(handle, appPassword) {
  if (_session && Date.now() < _session.expiresAt) return _session;
  const res = await fetch(`${BSKY_API}/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: handle, password: appPassword }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || JSON.stringify(data));
  }
  _session = {
    accessJwt: data.accessJwt,
    did: data.did,
    expiresAt: Date.now() + 90 * 60 * 1000,
  };
  return _session;
}

/**
 * @param {string} text 投稿本文
 * @returns {Promise<{ url: string } | null>} 未設定なら null
 */
export async function postBluesky(text) {
  const handle = process.env.BSKY_HANDLE;
  const appPassword = process.env.BSKY_APP_PASSWORD;
  if (!handle || !appPassword) return null;

  const { accessJwt, did } = await getSession(handle, appPassword);

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
    // セッション期限切れの場合はキャッシュをクリアして次回再取得
    if (res.status === 401) _session = null;
    throw new Error(data.message || data.error || JSON.stringify(data));
  }

  // at://did/app.bsky.feed.post/rkey → rkey を取り出す
  const rkey = data.uri.split("/").pop();
  const url = `https://bsky.app/profile/${handle}/post/${rkey}`;
  return { url };
}
