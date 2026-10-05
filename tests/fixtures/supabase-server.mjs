// Isolated Supabase HTTP contract fixture backed by real PostgreSQL (PGlite).
// It contains only invented users/tokens and never connects to a live service.
import { createServer } from "node:http";
import { createHmac, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
const uid = "00000000-0000-4000-8000-000000000002";
await db.exec(
  `create schema auth;create table auth.users(id uuid primary key);create role authenticated;create role anon;create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values('${uid}');`,
);
const folder = new URL("../../supabase/migrations/", import.meta.url);
for (const name of (await readdir(folder)).sort())
  await db.exec(await readFile(new URL(name, folder), "utf8"));
await db.exec("set role authenticated;");
const user = {
  id: uid,
  aud: "authenticated",
  role: "authenticated",
  email: "owner@example.invalid",
  email_confirmed_at: "2026-01-01T00:00:00Z",
  app_metadata: { provider: "email" },
  user_metadata: {},
  identities: [],
  created_at: "2026-01-01T00:00:00Z",
};
const sessions = new Map();
const refreshes = new Map();
let queue = Promise.resolve();
const issue = () => {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const payload = Buffer.from(
    JSON.stringify({
      sub: uid,
      aud: "authenticated",
      role: "authenticated",
      email: user.email,
      iat: exp - 3600,
      exp,
      jti: randomUUID(),
    }),
  ).toString("base64url");
  const signature = createHmac("sha256", "fixture-only-signing-secret")
    .update(`${header}.${payload}`)
    .digest("base64url");
  const access = `${header}.${payload}.${signature}`,
    refresh = randomUUID();
  sessions.set(access, user);
  refreshes.set(refresh, access);
  return {
    access_token: access,
    refresh_token: refresh,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: exp,
    user,
  };
};
createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:54329");
  const send = (code, data) => {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };
  if (url.pathname === "/health") {
    send(200, { ok: true });
    return;
  }
  let body = {};
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    if (chunks.length) body = JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    send(400, { message: "Invalid JSON" });
    return;
  }
  const token = req.headers.authorization?.replace(/^Bearer /, "");
  const current = sessions.get(token);
  if (url.pathname === "/auth/v1/token") {
    if (
      url.searchParams.get("grant_type") === "password" &&
      body.email === user.email &&
      body.password === "cloud-fixture-password-2026"
    ) {
      send(200, issue());
      return;
    }
    if (
      url.searchParams.get("grant_type") === "refresh_token" &&
      refreshes.has(body.refresh_token)
    ) {
      send(200, issue());
      return;
    }
    send(400, {
      code: "invalid_credentials",
      message: "Invalid login credentials",
    });
    return;
  }
  if (url.pathname === "/auth/v1/recover") {
    send(200, {});
    return;
  }
  if (url.pathname === "/auth/v1/user") {
    if (!current) {
      send(401, { code: "bad_jwt", message: "Invalid token" });
      return;
    }
    send(200, current);
    return;
  }
  if (url.pathname === "/auth/v1/logout") {
    sessions.delete(token);
    send(200, {});
    return;
  }
  if (url.pathname === "/auth/v1/.well-known/jwks.json") {
    send(200, { keys: [] });
    return;
  }
  if (url.pathname.startsWith("/rest/v1/rpc/")) {
    if (!current) {
      send(401, { code: "42501", message: "Authentication required" });
      return;
    }
    queue = queue.then(async () => {
      await db.query("select set_config('app.uid',$1,false)", [current.id]);
      try {
        if (url.pathname.endsWith("/luki_home_get_state_v3")) {
          const r = await db.query(
            "select public.luki_home_get_state_v3() as state",
          );
          send(200, r.rows[0].state);
          return;
        }
        if (url.pathname.endsWith("/luki_home_save_state_v3")) {
          await db.query(
            "select public.luki_home_save_state_v3($1::jsonb,$2)",
            [JSON.stringify(body.p_state), body.p_revision],
          );
          send(200, null);
          return;
        }
        send(404, { code: "PGRST202", message: "Function not found" });
      } catch (e) {
        send(e.code === "40001" ? 409 : 400, {
          code: e.code,
          message: e.message,
        });
      }
    });
    return;
  }
  send(404, { message: "Fixture route not found" });
}).listen(54329, "127.0.0.1", () =>
  console.log("Isolated Supabase fixture ready"),
);
