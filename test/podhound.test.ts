import { describe, it, expect, beforeAll } from "bun:test";
import { runMigrations } from "../src/db/migrate";
import { db } from "../src/db/client";
import { getOrCreateUser } from "../src/routes/auth";
import { handleSubscriptions } from "../src/routes/subscriptions";
import { handleEpisodeActions } from "../src/routes/episodes";

describe("Podhound Core Tests", () => {
  beforeAll(() => {
    runMigrations();
  });

  it("should apply migrations and create tables", () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[];
    const names = tables.map((t) => t.name);

    expect(names).toContain("users");
    expect(names).toContain("subscriptions");
    expect(names).toContain("episode_actions");
    expect(names).toContain("_migrations");
  });

  it("should create and authenticate users", () => {
    const user1 = getOrCreateUser("testuser", "secret123");
    expect(user1).not.toBeNull();
    expect(user1?.username).toBe("testuser");

    // Authenticate with wrong password should fail
    const invalid = getOrCreateUser("testuser", "wrongpassword");
    expect(invalid).toBeNull();

    // Authenticate with correct password should succeed
    const valid = getOrCreateUser("testuser", "secret123");
    expect(valid).not.toBeNull();
    expect(valid?.id).toBe(user1?.id);
  });

  it("should manage subscriptions via handleSubscriptions", async () => {
    const basicAuth = btoa("subuser:password123");

    // Add subscription
    const addReq = new Request("http://localhost/api/2/subscriptions/subuser/phone.json", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basicAuth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        add: ["https://feed.example.com/podcast.xml"],
        remove: [],
      }),
    });

    const addRes = await handleSubscriptions(addReq, "subuser", "phone");
    expect(addRes.status).toBe(200);

    // List subscriptions
    const listReq = new Request("http://localhost/api/2/subscriptions/subuser/phone.json", {
      method: "GET",
      headers: {
        "Authorization": `Basic ${basicAuth}`,
      },
    });

    const listRes = await handleSubscriptions(listReq, "subuser", "phone");
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    expect(listData).toEqual(["https://feed.example.com/podcast.xml"]);
  });

  it("should record and query episode actions", async () => {
    const basicAuth = btoa("epuser:password123");

    // Send episode action
    const postReq = new Request("http://localhost/api/2/episodes/epuser.json", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basicAuth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          podcast: "https://feed.example.com/podcast.xml",
          episode: "https://feed.example.com/ep1.mp3",
          action: "play",
          position: 150,
          total: 1800,
          timestamp: 1700000000,
        },
      ]),
    });

    const postRes = await handleEpisodeActions(postReq, "epuser");
    expect(postRes.status).toBe(200);

    // Query episode actions
    const getReq = new Request("http://localhost/api/2/episodes/epuser.json?since=1699999999", {
      method: "GET",
      headers: {
        "Authorization": `Basic ${basicAuth}`,
      },
    });

    const getRes = await handleEpisodeActions(getReq, "epuser");
    expect(getRes.status).toBe(200);
    const getData = (await getRes.json()) as { actions: any[] };
    expect(getData.actions.length).toBeGreaterThanOrEqual(1);
    expect(getData.actions[0].podcast).toBe("https://feed.example.com/podcast.xml");
    expect(getData.actions[0].position).toBe(150);
  });
});
