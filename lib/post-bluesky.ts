const BSKY_API = "https://bsky.social/xrpc";

interface BlueskySession {
  accessJwt: string;
  did: string;
  expiresAt: number;
}

// セッションを90分間キャッシュして createSession のレート制限を回避
let _session: BlueskySession | null = null;

async function getSession(handle: string, appPassword: string): Promise<BlueskySession> {
  if (_session && Date.now() < _session.expiresAt) return _session;
  const res = await fetch(`${BSKY_API}/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: handle, password: appPassword }),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as any;
  if (!res.ok) {
    throw new Error(data.message || data.error || JSON.stringify(data));
  }
  _session = {
    accessJwt: data.accessJwt as string,
    did: data.did as string,
    expiresAt: Date.now() + 90 * 60 * 1000,
  };
  return _session;
}

export async function postBluesky(text: string): Promise<{ url: string } | null> {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as any;
  if (!res.ok) {
    if (res.status === 401) _session = null;
    throw new Error(data.message || data.error || JSON.stringify(data));
  }

  const rkey = (data.uri as string).split("/").pop();
  const url = `https://bsky.app/profile/${handle}/post/${rkey}`;
  return { url };
}
