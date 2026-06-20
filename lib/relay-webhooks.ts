async function postJson(url: string, body: Record<string, string>): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`HTTP ${res.status}: ${t.slice(0, 200)}`);
  }
}

export async function relayWebhooks(text: string): Promise<void> {
  const slack = process.env.SLACK_WEBHOOK_URL;
  const discord = process.env.DISCORD_WEBHOOK_URL;
  if (!slack && !discord) {
    throw new Error(
      "SLACK_WEBHOOK_URL または DISCORD_WEBHOOK_URL を .env に設定してください。"
    );
  }
  const tasks: Promise<void>[] = [];
  if (slack) tasks.push(postJson(slack, { text }));
  if (discord) tasks.push(postJson(discord, { content: text }));
  await Promise.all(tasks);
}
