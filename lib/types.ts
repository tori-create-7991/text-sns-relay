export type PlatformResult =
  | { url: string; ok: true }
  | { url: null; ok: false; error: string }
  | null;

export interface HistoryEntry {
  sent_at: string;
  text: string;
  x: PlatformResult;
  bluesky: PlatformResult;
  threads: PlatformResult;
}

export interface PostAllResult {
  x: PlatformResult;
  bluesky: PlatformResult;
  threads: PlatformResult;
}

export interface OAuth1aParams {
  method: string;
  url: string;
  consumerKey: string;
  consumerSecret: string;
  // 3-legged flow の request_token 取得時点ではまだ token/tokenSecret が無い
  token?: string;
  tokenSecret?: string;
  // oauth_callback（request_token時）/ oauth_verifier（access_token交換時）等
  extraOAuthParams?: Record<string, string>;
}
