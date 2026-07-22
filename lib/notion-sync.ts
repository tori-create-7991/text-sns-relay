import type { HistoryEntry, PlatformResult } from "./types";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function urlOf(r: PlatformResult): string | null {
  return r?.ok ? r.url : null;
}

/**
 * text-sns-relay の送信履歴を Notion DB「つぶやきログ」へ1件追加する。
 * NOTION_TOKEN / NOTION_TWEETS_DB_ID が未設定の場合は何もしない（無効化扱い）。
 * blog(tori-dev-blog)がこのDBを共有の真実の情報源として参照する
 * （tori-dev-blog docs/adr/0003 参照）。
 */
export async function syncToNotion(entry: HistoryEntry): Promise<void> {
  const token = process.env.NOTION_TOKEN;
  const dbId = process.env.NOTION_TWEETS_DB_ID;
  if (!token || !dbId) return;

  const platforms: string[] = [];
  if (entry.x?.ok) platforms.push("X");
  if (entry.bluesky?.ok) platforms.push("Bluesky");
  if (entry.threads?.ok) platforms.push("Threads");

  const properties: Record<string, unknown> = {
    Text: {
      title: [{ type: "text", text: { content: entry.text.slice(0, 2000) } }],
    },
    Platforms: {
      multi_select: platforms.map((name) => ({ name })),
    },
    PostedAt: { date: { start: entry.sent_at } },
  };

  const xUrl = urlOf(entry.x);
  const bskyUrl = urlOf(entry.bluesky);
  const threadsUrl = urlOf(entry.threads);
  if (xUrl) properties.URL_X = { url: xUrl };
  if (bskyUrl) properties.URL_Bluesky = { url: bskyUrl };
  if (threadsUrl) properties.URL_Threads = { url: threadsUrl };

  const res = await fetch(`${NOTION_API}/pages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      parent: { database_id: dbId },
      properties,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg =
      (data as any).message || (data as any).code || JSON.stringify(data);
    console.error("Notion同期失敗:", msg);
  }
}
