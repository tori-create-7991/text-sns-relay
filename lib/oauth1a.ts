import { createHmac, randomBytes } from "node:crypto";
import type { OAuth1aParams } from "./types";

function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

function nonce(): string {
  return randomBytes(16).toString("hex");
}

export function oauth1AuthorizationHeader(p: OAuth1aParams): string {
  const { method, url, consumerKey, consumerSecret, token, tokenSecret } = p;

  const oauth: Record<string, string> = {
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
  const signature = createHmac("sha1", signingKey).update(baseString).digest("base64");

  const withSig: Record<string, string> = { ...oauth, oauth_signature: signature };
  const headerKeys = Object.keys(withSig).sort();
  const parts = headerKeys.map(
    (k) => `${percentEncode(k)}="${percentEncode(withSig[k])}"`
  );
  return `OAuth ${parts.join(", ")}`;
}
