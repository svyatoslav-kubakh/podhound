import { db } from "../db/client";

export interface User {
  id: number;
  username: string;
  password_hash: string;
}

export function getOrCreateUser(username: string, password: string): User | null {
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as User | null;

  if (!user) {
    const password_hash = Bun.password.hashSync(password);
    const result = db
      .prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)")
      .run(username, password_hash);
    return {
      id: Number(result.lastInsertRowid),
      username,
      password_hash,
    };
  }

  const isValid = Bun.password.verifySync(password, user.password_hash);
  if (!isValid) {
    return null;
  }

  return user;
}

export function authenticateRequest(req: Request): User | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return null;
  }

  try {
    const credentials = atob(authHeader.substring(6));
    const [username, password] = credentials.split(":");
    if (!username || !password) return null;

    return getOrCreateUser(username, password);
  } catch {
    return null;
  }
}

export async function handleLogin(req: Request, urlUsername: string): Promise<Response> {
  let user = authenticateRequest(req);

  if (!user && req.method === "POST") {
    // Try reading JSON body if Basic auth wasn't present
    try {
      const body = await req.json() as { password?: string };
      if (body.password) {
        user = getOrCreateUser(urlUsername, body.password);
      }
    } catch {
      // Body wasn't JSON
    }
  }

  if (!user || user.username !== urlUsername) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `session_user=${user.username}; Path=/; HttpOnly; SameSite=Lax`,
    },
  });
}

export function handleDevices(req: Request, username: string): Response {
  const user = authenticateRequest(req);
  if (!user || user.username !== username) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (req.method === "GET") {
    // Return list of registered devices or a default AntennaPod device
    return new Response(
      JSON.stringify([
        {
          id: "antennapod",
          caption: "AntennaPod",
          type: "phone",
          subscriptions: 0,
        },
      ]),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // POST registration of device
  return new Response("OK", { status: 200 });
}
