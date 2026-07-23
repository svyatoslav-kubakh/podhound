import { db } from "../db/client";
import { authenticateRequest } from "./auth";

export interface EpisodeActionPayload {
  podcast: string;
  episode: string;
  action: string;
  timestamp?: number;
  position?: number;
  total?: number;
}

export async function handleEpisodeActions(
  req: Request,
  username: string
): Promise<Response> {
  const user = authenticateRequest(req);
  if (!user || user.username !== username) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);

  if (req.method === "GET") {
    const sinceParam = url.searchParams.get("since");
    const podcastParam = url.searchParams.get("podcast");
    const sinceTimestamp = sinceParam ? parseInt(sinceParam, 10) || 0 : 0;

    let query = "SELECT podcast_url as podcast, episode_url as episode, action, position, total, timestamp FROM episode_actions WHERE user_id = ? AND timestamp >= ?";
    const params: (string | number)[] = [user.id, sinceTimestamp];

    if (podcastParam) {
      query += " AND podcast_url = ?";
      params.push(podcastParam);
    }

    query += " ORDER BY timestamp ASC";

    const actions = db.prepare(query).all(...params) as EpisodeActionPayload[];

    const nowTimestamp = Math.floor(Date.now() / 1000);
    return new Response(
      JSON.stringify({
        actions,
        timestamp: nowTimestamp,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  if (req.method === "POST") {
    try {
      const actions = (await req.json()) as EpisodeActionPayload[];
      if (!Array.isArray(actions)) {
        return new Response(JSON.stringify({ error: "Payload must be an array" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const nowTimestamp = Math.floor(Date.now() / 1000);

      db.transaction(() => {
        const stmt = db.prepare(`
          INSERT INTO episode_actions (user_id, podcast_url, episode_url, action, position, total, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        for (const act of actions) {
          if (!act.podcast || !act.episode || !act.action) continue;
          const ts = act.timestamp || nowTimestamp;
          const pos = act.position || 0;
          const tot = act.total || 0;

          stmt.run(user.id, act.podcast, act.episode, act.action, pos, tot, ts);
        }
      })();

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
