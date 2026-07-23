import { db } from "../db/client";
import { authenticateRequest } from "./auth";

export async function handleSubscriptions(
  req: Request,
  username: string,
  _device: string
): Promise<Response> {
  const user = authenticateRequest(req);
  if (!user || user.username !== username) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (req.method === "GET") {
    const rows = db
      .prepare("SELECT podcast_url FROM subscriptions WHERE user_id = ?")
      .all(user.id) as { podcast_url: string }[];

    const urls = rows.map((r) => r.podcast_url);
    return new Response(JSON.stringify(urls), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (req.method === "POST") {
    try {
      const body = (await req.json()) as { add?: string[]; remove?: string[] };
      const addList = body.add || [];
      const removeList = body.remove || [];

      db.transaction(() => {
        const insertStmt = db.prepare(
          "INSERT OR IGNORE INTO subscriptions (user_id, podcast_url) VALUES (?, ?)"
        );
        for (const url of addList) {
          if (url) insertStmt.run(user.id, url);
        }

        const deleteStmt = db.prepare(
          "DELETE FROM subscriptions WHERE user_id = ? AND podcast_url = ?"
        );
        for (const url of removeList) {
          if (url) deleteStmt.run(user.id, url);
        }
      })();

      const nowTimestamp = Math.floor(Date.now() / 1000);
      return new Response(
        JSON.stringify({
          timestamp: nowTimestamp,
          update_urls: [],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Method Not Allowed", { status: 405 });
}
