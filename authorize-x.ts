#!/usr/bin/env tsx
import { createServer } from "node:http";
import { loadEnv } from "./lib/load-env";
import { getRequestToken, buildAuthorizeUrl, getAccessToken } from "./lib/x-oauth-flow";

await loadEnv();

const PORT = Number(process.env.X_OAUTH_CALLBACK_PORT ?? "3849");
const CALLBACK_URL = `http://127.0.0.1:${PORT}/callback`;

const consumerKey = process.env.X_API_KEY;
const consumerSecret = process.env.X_API_SECRET;
if (!consumerKey || !consumerSecret) {
  console.error("X_API_KEY, X_API_SECRET を .env に設定してください（アプリのコンシューマーキー）。");
  process.exit(1);
}

async function main(): Promise<void> {
  const { oauthToken } = await getRequestToken(consumerKey!, consumerSecret!, CALLBACK_URL);

  const server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
      if (url.pathname !== "/callback") {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      const verifier = url.searchParams.get("oauth_verifier");
      const returnedToken = url.searchParams.get("oauth_token");
      if (!verifier || returnedToken !== oauthToken) {
        res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("認証に失敗しました（oauth_verifier が取得できませんでした）。");
        server.close();
        process.exitCode = 1;
        return;
      }
      try {
        const result = await getAccessToken(consumerKey!, consumerSecret!, oauthToken, verifier);
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("認証完了。ターミナルを確認してください。このタブは閉じて構いません。");
        console.log("\n認証成功:");
        console.log(`  アカウント: @${result.screenName}（user_id: ${result.userId}）`);
        console.log(`  X_ACCESS_TOKEN=${result.oauthToken}`);
        console.log(`  X_ACCESS_TOKEN_SECRET=${result.oauthTokenSecret}`);
        console.log("\n.env の該当値を書き換えるか、Secret Manager に保存してください。");
      } catch (e) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("エラーが発生しました。ターミナルを確認してください。");
        console.error(e instanceof Error ? e.message : e);
        process.exitCode = 1;
      } finally {
        server.close();
      }
    })();
  });

  server.listen(PORT, "127.0.0.1", () => {
    const authorizeUrl = buildAuthorizeUrl(oauthToken);
    console.log("投稿させたい X アカウントでログインしたブラウザで、以下の URL を開いて許可してください:\n");
    console.log(authorizeUrl);
    console.log(`\n(コールバック待受中: ${CALLBACK_URL})`);
  });
}

main().catch((e: Error) => {
  console.error(e.message || e);
  process.exit(1);
});
