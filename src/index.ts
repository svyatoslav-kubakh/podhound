import { runMigrations } from "./db/migrate";
import { handleLogin, handleDevices } from "./routes/auth";
import { handleSubscriptions } from "./routes/subscriptions";
import { handleEpisodeActions } from "./routes/episodes";

// Run SQLite migrations at startup
runMigrations();

const PORT = parseInt(process.env.PORT || "8080", 10);

const server = Bun.serve({
  port: PORT,
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // Health check / Info root endpoint
    if (pathname === "/" || pathname === "/health") {
      return new Response(
        JSON.stringify({
          service: "Podhound",
          status: "healthy",
          gpodder_api: "v2",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Match /api/2/auth/<username>/login.json
    const authMatch = pathname.match(/^\/api\/2\/auth\/([^/]+)\/login\.json$/);
    if (authMatch) {
      const username = authMatch[1];
      return handleLogin(req, username);
    }

    // Match /api/2/devices/<username>.json or /api/2/devices/<username>/<device_id>.json
    const deviceMatch = pathname.match(/^\/api\/2\/devices\/([^/.]+)(?:\/[^/]+)?\.json$/);
    if (deviceMatch) {
      const username = deviceMatch[1];
      return handleDevices(req, username);
    }

    // Match /api/2/subscriptions/<username>/<device>.json
    const subMatch = pathname.match(/^\/api\/2\/subscriptions\/([^/]+)\/([^/]+)\.json$/);
    if (subMatch) {
      const username = subMatch[1];
      const device = subMatch[2];
      return handleSubscriptions(req, username, device);
    }

    // Match /api/2/episodes/<username>.json
    const episodeMatch = pathname.match(/^\/api\/2\/episodes\/([^/]+)\.json$/);
    if (episodeMatch) {
      const username = episodeMatch[1];
      return handleEpisodeActions(req, username);
    }

    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  },
});

console.log(`[Podhound 🐶] Server is listening on http://localhost:${server.port}`);
