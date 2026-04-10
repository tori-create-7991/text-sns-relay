/**
 * Twitter / X API 用 OAuth 1.0a ヘッダー（ユーザーコンテキスト）
 * POST JSON ボディは署名に含めない（OAuth パラメータのみ）
 */

import crypto from "node:crypto";

function percentEncode(str) {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

function nonce() {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * @param {object} p
 * @param {string} p.method GET | POST
 * @param {string} p.url クエリなしのベース URL（例: https://api.twitter.com/2/tweets）
 * @param {string} p.consumerKey API Key
 * @param {string} p.consumerSecret API Key Secret
 * @param {string} p.token Access Token
 * @param {string} p.tokenSecret Access Token Secret
 */
export function oauth1AuthorizationHeader({
  method,
  url,
  consumerKey,
  consumerSecret,
  token,
  tokenSecret,
}) {
  const oauth = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce(),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: token,
    oauth_version: "1.0",
  };

  const keys = Object.keys(oauth).sort();
  const paramString = keys
    .map((k) => `${percentEncode(k)}=${percentEncode(oauth[k])}`)
    .join("&");
  const baseString = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(paramString),
  ].join("&");
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  const signature = crypto
    .createHmac("sha1", signingKey)
    .update(baseString)
    .digest("base64");

  const withSig = { ...oauth, oauth_signature: signature };
  const headerKeys = Object.keys(withSig).sort();
  const parts = headerKeys.map(
    (k) => `${percentEncode(k)}="${percentEncode(withSig[k])}"`
  );
  return `OAuth ${parts.join(", ")}`;
}
