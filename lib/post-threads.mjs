/**
 * Meta Threads API への投稿（2ステップ: container 作成 → publish）
 * 必要env: THREADS_USER_ID, THREADS_ACCESS_TOKEN
 */

const THREADS_API = "https://graph.threads.net/v1.0";

/**
 * @param {string} text 投稿本文
 * @returns {Promise<{ url: string } | null>} 未設定なら null
 */
export async function postThreads(text) {
  const userId = process.env.THREADS_USER_ID;
  const token = process.env.THREADS_ACCESS_TOKEN;
  if (!userId || !token) return null;

  // Step 1: media container 作成
  const createParams = new URLSearchParams({
    media_type: "TEXT",
    text,
    access_token: token,
  });
  const createRes = await fetch(`${THREADS_API}/${userId}/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: createParams,
  });
  const createData = await createRes.json();
  if (!createRes.ok) {
    const msg =
      createData.error?.message || createData.message || JSON.stringify(createData);
    throw new Error(msg);
  }
  const creationId = createData.id;

  // Step 2: publish
  const publishParams = new URLSearchParams({
    creation_id: creationId,
    access_token: token,
  });
  const publishRes = await fetch(`${THREADS_API}/${userId}/threads_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: publishParams,
  });
  const publishData = await publishRes.json();
  if (!publishRes.ok) {
    const msg =
      publishData.error?.message || publishData.message || JSON.stringify(publishData);
    throw new Error(msg);
  }

  const postId = publishData.id;
  const url = `https://www.threads.net/post/${postId}`;
  return { url };
}
