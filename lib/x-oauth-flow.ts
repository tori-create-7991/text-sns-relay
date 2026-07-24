import { oauth1AuthorizationHeader } from "./oauth1a";

const REQUEST_TOKEN_URL = "https://api.twitter.com/oauth/request_token";
const AUTHORIZE_URL = "https://api.twitter.com/oauth/authorize";
const ACCESS_TOKEN_URL = "https://api.twitter.com/oauth/access_token";

function parseFormUrlEncoded(body: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const pair of body.split("&")) {
    const [k, v] = pair.split("=");
    if (!k) continue;
    params[decodeURIComponent(k)] = decodeURIComponent(v ?? "");
  }
  return params;
}

export interface RequestToken {
  oauthToken: string;
  oauthTokenSecret: string;
}

// 3-legged OAuth1.0a ステップ1: 未認可のリクエストトークンを取得する
export async function getRequestToken(
  consumerKey: string,
  consumerSecret: string,
  callbackUrl: string
): Promise<RequestToken> {
  const auth = oauth1AuthorizationHeader({
    method: "POST",
    url: REQUEST_TOKEN_URL,
    consumerKey,
    consumerSecret,
    extraOAuthParams: { oauth_callback: callbackUrl },
  });
  const res = await fetch(REQUEST_TOKEN_URL, { method: "POST", headers: { Authorization: auth } });
  const body = await res.text();
  if (!res.ok) throw new Error(`request_token 取得失敗: ${body}`);
  const params = parseFormUrlEncoded(body);
  if (params.oauth_callback_confirmed !== "true") {
    throw new Error("oauth_callback_confirmed が true ではありません（callback URL 未登録の可能性）。");
  }
  return { oauthToken: params.oauth_token, oauthTokenSecret: params.oauth_token_secret };
}

// ステップ2: このURLをブラウザで開いて対象アカウントに許可させる
export function buildAuthorizeUrl(oauthToken: string): string {
  return `${AUTHORIZE_URL}?oauth_token=${encodeURIComponent(oauthToken)}`;
}

export interface AccessToken {
  oauthToken: string;
  oauthTokenSecret: string;
  userId: string;
  screenName: string;
}

// ステップ3: callback で受け取った oauth_verifier を使い、認可した本人のアクセストークンへ交換する
export async function getAccessToken(
  consumerKey: string,
  consumerSecret: string,
  oauthToken: string,
  oauthVerifier: string
): Promise<AccessToken> {
  const auth = oauth1AuthorizationHeader({
    method: "POST",
    url: ACCESS_TOKEN_URL,
    consumerKey,
    consumerSecret,
    token: oauthToken,
    extraOAuthParams: { oauth_verifier: oauthVerifier },
  });
  const res = await fetch(ACCESS_TOKEN_URL, { method: "POST", headers: { Authorization: auth } });
  const body = await res.text();
  if (!res.ok) throw new Error(`access_token 交換失敗: ${body}`);
  const params = parseFormUrlEncoded(body);
  return {
    oauthToken: params.oauth_token,
    oauthTokenSecret: params.oauth_token_secret,
    userId: params.user_id,
    screenName: params.screen_name,
  };
}
