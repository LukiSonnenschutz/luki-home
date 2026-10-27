import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
const fixture = "http://127.0.0.1:54329/__test/control";
async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill("owner@example.invalid");
  await page
    .getByLabel("Passwort", { exact: true })
    .fill("cloud-fixture-password-2026");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Lukas/ })).toBeVisible();
}
async function control(
  request: APIRequestContext,
  data: Record<string, unknown>,
) {
  return (await request.post(fixture, { data })).json();
}
test("GET never saves; an expired timer with permanent 409 stops instead of retrying on ticks", async ({
  page,
  request,
}) => {
  await login(page);
  const initial = await (await page.request.get("/api/state")).json();
  await control(request, { reset: true, conflicts: 0 });
  for (let i = 0; i < 5; i++)
    expect((await page.request.get("/api/state")).status()).toBe(200);
  expect((await (await request.get(fixture)).json()).writes).toBe(0);
  const started = await page.request.post("/api/state", {
    headers: { Origin: "http://127.0.0.1:3102" },
    data: {
      type: "work",
      action: "start",
      minutes: 1,
      date: initial.today,
      revision: initial.state.revision,
    },
  });
  expect(started.status(), await started.text()).toBe(200);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Fokus pausieren", exact: true }),
  ).toBeVisible();
  await page.clock.install();
  await control(request, { reset: true, conflicts: 100, expireFocus: true });
  await page.clock.fastForward(70_000);
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: /Automatische Aktualisierung pausiert/ }),
  ).toBeVisible();
  const failed = await (await request.get(fixture)).json();
  expect(failed.writes).toBe(1);
  await page.clock.fastForward(10 * 60_000);
  expect(await (await request.get(fixture)).json()).toEqual(failed);
  await control(request, { conflicts: 0 });
  await page
    .getByRole("button", { name: "Aktuellen Stand laden", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Fokusblock beendet" }),
  ).toBeVisible();
  const stored = await (await page.request.get("/api/state")).json();
  expect(stored.needsSync).toBe(false);
  expect(stored.state.work_sessions.at(-1).status).toBe("done");
});

test("manual conflict preserves a draft and requires a conscious second save", async ({
  page,
  request,
}) => {
  await control(request, { conflicts: 0 });
  await login(page);
  await page.getByRole("button", { name: "Aufgaben", exact: true }).click();
  await page.getByRole("button", { name: "Neue Aufgabe", exact: true }).click();
  await page
    .getByLabel("Was möchtest du erledigen?")
    .fill("Konfliktentwurf behalten");
  await page.getByLabel("Notiz", { exact: true }).fill("Nicht verlieren");
  await control(request, { reset: true, conflicts: 1 });
  await page
    .getByRole("button", { name: "Aufgabe speichern", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "inzwischen geändert",
  );
  await expect(page.getByLabel("Was möchtest du erledigen?")).toHaveValue(
    "Konfliktentwurf behalten",
  );
  await expect(page.getByLabel("Notiz", { exact: true })).toHaveValue(
    "Nicht verlieren",
  );
  expect((await (await request.get(fixture)).json()).writes).toBe(1);
  await page
    .getByRole("button", { name: "Aufgabe speichern", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const stored = await (await page.request.get("/api/state")).json();
  expect(
    stored.state.tasks.filter(
      (t: { title: string }) => t.title === "Konfliktentwurf behalten",
    ),
  ).toHaveLength(1);
  await control(request, { reset: true });
  const stale = await page.request.post("/api/state", {
    headers: { Origin: "http://127.0.0.1:3102" },
    data: {
      type: "synchronize",
      date: stored.date,
      revision: stored.state.revision - 1,
    },
  });
  expect(stale.status()).toBe(409);
  expect((await (await request.get(fixture)).json()).writes).toBe(0);
});
