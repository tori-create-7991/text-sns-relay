#!/usr/bin/env node
/**
 * ローカル用 Web UI（127.0.0.1 のみ既定）。ブラウザから投稿 → Slack/Discord へ共有。
 */

import { createServer } from "node:http";
import { loadEnv } from "./lib/load-env.mjs";
import { postTweetAndRelay } from "./lib/post-x.mjs";

loadEnv();

const HOST = process.env.RELAY_UI_HOST ?? "127.0.0.1";
const PORT = Number(process.env.RELAY_UI_PORT ?? "3847", 10);
const MAX_BODY = 65536;

function checkBasicAuth(req) {
  const user = process.env.RELAY_UI_USER;
  const pass = process.env.RELAY_UI_PASSWORD;
  if (!user || !pass) return true;
  const h = req.headers.authorization;
  if (!h?.startsWith("Basic ")) return false;
  let decoded;
  try {
    decoded = Buffer.from(h.slice(6), "base64").toString("utf8");
  } catch {
    return false;
  }
  const i = decoded.indexOf(":");
  const u = i === -1 ? decoded : decoded.slice(0, i);
  const p = i === -1 ? "" : decoded.slice(i + 1);
  return u === user && p === pass;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("リクエストが大きすぎます。"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const HTML = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>X → Slack / Discord</title>
  <style>
    :root {
      --bg: #0f1419;
      --card: #1a2332;
      --border: #2d3a4d;
      --text: #e7ecf3;
      --muted: #8b9cb3;
      --accent: #1d9bf0;
      --accent-hover: #1a8cd8;
      --err: #f4212e;
      --ok: #00ba7c;
      font-family: ui-sans-serif, system-ui, "Segoe UI", Roboto, "Hiragino Sans", "Noto Sans JP", sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; background: var(--bg); color: var(--text);
      display: flex; align-items: flex-start; justify-content: center;
      padding: 2rem 1rem;
    }
    .card {
      width: 100%; max-width: 32rem;
      background: var(--card); border: 1px solid var(--border);
      border-radius: 12px; padding: 1.5rem 1.25rem;
      box-shadow: 0 8px 32px rgba(0,0,0,.35);
    }
    h1 { font-size: 1.125rem; font-weight: 600; margin: 0 0 0.25rem; }
    p.sub { margin: 0 0 1.25rem; font-size: 0.8125rem; color: var(--muted); line-height: 1.5; }
    label { display: block; font-size: 0.75rem; color: var(--muted); margin-bottom: 0.35rem; }
    textarea {
      width: 100%; min-height: 7rem; resize: vertical;
      padding: 0.65rem 0.75rem; border-radius: 8px;
      border: 1px solid var(--border); background: var(--bg); color: var(--text);
      font-size: 0.9375rem; line-height: 1.45;
    }
    textarea:focus { outline: 2px solid var(--accent); outline-offset: 1px; border-color: transparent; }
    .row { margin-top: 1rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    input[type="checkbox"] { accent-color: var(--accent); width: 1rem; height: 1rem; }
    .chk label { display: inline; font-size: 0.8125rem; color: var(--text); margin: 0; cursor: pointer; }
    button {
      margin-top: 1rem; width: 100%;
      padding: 0.65rem 1rem; border: none; border-radius: 999px;
      background: var(--accent); color: #fff; font-size: 0.9375rem; font-weight: 600;
      cursor: pointer;
    }
    button:hover:not(:disabled) { background: var(--accent-hover); }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    #msg { margin-top: 1rem; font-size: 0.8125rem; line-height: 1.5; min-height: 1.25rem; }
    #msg.err { color: var(--err); }
    #msg.ok { color: var(--ok); word-break: break-all; }
    footer { margin-top: 1.25rem; font-size: 0.6875rem; color: var(--muted); line-height: 1.4; }
  </style>
</head>
<body>
  <div class="card">
    <h1>X に投稿 → Slack / Discord</h1>
    <p class="sub">この画面はローカル（${HOST}:${PORT}）のみで使う想定です。Webhook と X OAuth は .env に設定してください。</p>
    <label for="text">投稿本文</label>
    <textarea id="text" maxlength="5000" placeholder="いま書きたいこと…"></textarea>
    <div class="row chk">
      <input type="checkbox" id="shareBody" />
      <label for="shareBody">Slack / Discord には本文も送る（URL に加えて）</label>
    </div>
    <button type="button" id="btn">投稿して共有</button>
    <div id="msg" role="status"></div>
    <footer>秘密情報はブラウザに出しません。Basic 認証は RELAY_UI_USER / RELAY_UI_PASSWORD で有効化できます。</footer>
  </div>
  <script>
    const text = document.getElementById("text");
    const shareBody = document.getElementById("shareBody");
    const btn = document.getElementById("btn");
    const msg = document.getElementById("msg");
    function setMsg(t, ok) {
      msg.textContent = t || "";
      msg.className = ok === true ? "ok" : ok === false ? "err" : "";
    }
    btn.addEventListener("click", async () => {
      const body = text.value.trim();
      if (!body) { setMsg("本文を入力してください。", false); return; }
      btn.disabled = true;
      setMsg("送信中…", null);
      try {
        const res = await fetch("/api/post", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: body, shareBody: shareBody.checked }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || res.statusText);
        setMsg("完了: " + data.url, true);
        text.value = "";
      } catch (e) {
        setMsg(e.message || String(e), false);
      } finally {
        btn.disabled = false;
      }
    });
  </script>
</body>
</html>`;

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/") {
    if (!checkBasicAuth(req)) {
      res.writeHead(401, {
        "WWW-Authenticate": 'Basic realm="x-times-relay"',
        "Content-Type": "text/plain; charset=utf-8",
      });
      res.end("認証が必要です。");
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(HTML);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/post") {
    if (!checkBasicAuth(req)) {
      res.writeHead(401, {
        "WWW-Authenticate": 'Basic realm="x-times-relay"',
        "Content-Type": "application/json",
      });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    let raw;
    try {
      raw = await readBody(req);
    } catch (e) {
      res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: e.message }));
      return;
    }
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "JSON が不正です。" }));
      return;
    }
    const text = typeof payload.text === "string" ? payload.text.trim() : "";
    const shareBody = Boolean(payload.shareBody);
    if (!text) {
      res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "text が空です。" }));
      return;
    }

    try {
      const result = await postTweetAndRelay({ text, shareBody });
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({
          error: e.message || String(e),
        })
      );
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not Found");
});

server.listen(PORT, HOST, () => {
  console.error(
    `x-times-relay UI: http://${HOST}:${PORT}/\n` +
      "止めるには Ctrl+C です。"
  );
});
