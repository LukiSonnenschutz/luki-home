import { test, expect } from "@playwright/test";
import { newState } from "../../src/lib/model";
import { ensureDay, applyCommand } from "../../src/lib/domain";
import { exportState } from "../../src/lib/export";
test("Cloud-Vertrag: privater Login, ZIP-Übernahme, Speicherung und Abmeldung", async ({
  page,
  request,
  context,
}) => {
  expect((await request.get("/api/state")).status()).toBe(401);
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill("owner@example.invalid");
  await page
    .getByLabel("Passwort", { exact: true })
    .fill("cloud-fixture-password-2026");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Lukas/ })).toBeVisible();
  await expect(page.getByText("Online · v0.2.0")).toBeVisible();
  const cookies = await context.cookies();
  expect(
    cookies.some((c) => c.name.startsWith("luki-home-auth") && c.httpOnly),
  ).toBe(true);
  const response = await page.request.get("/api/state");
  const dashboard = await response.json();
  expect(dashboard.mode).toBe("supabase");
  const original = newState("00000000-0000-4000-8000-000000000001");
  const date = dashboard.today;
  const now = new Date();
  ensureDay(original, date);
  applyCommand(
    original,
    {
      type: "task-create",
      date,
      title: "Vom Rechner übernommen",
      notes: "Lokale Notiz",
      due_date: date,
    },
    now,
  );
  applyCommand(
    original,
    {
      type: "day",
      date,
      focus_text: "Meine lokale Tagesplanung",
      focus_task_id: original.tasks[0].id,
      training_note: "",
      training_time: null,
    },
    now,
  );
  const archive = await exportState(original, now);
  await page
    .getByRole("button", { name: "Einstellungen", exact: true })
    .click();
  await page.getByLabel("Luki-Home-Export (.zip)").setInputFiles({
    name: "local-export.zip",
    mimeType: "application/zip",
    buffer: Buffer.from(archive),
  });
  const imported = page.waitForResponse((r) => r.url().endsWith("/api/import"));
  await page.getByRole("button", { name: "Lokalen Export übernehmen" }).click();
  expect((await imported).status()).toBe(200);
  await expect(
    page.getByText(
      "Dieser Zugang enthält bereits Daten. Ein überschreibender Import ist gesperrt.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Heute", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Meine lokale Tagesplanung" }),
  ).toBeVisible();
  await expect(
    page.getByText("Vom Rechner übernommen", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Aufstehen: erledigen" }).click();
  await expect(
    page.getByRole("button", { name: "Aufstehen: wieder öffnen" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Aufstehen: wieder öffnen" }),
  ).toBeVisible();
  const saved = await (await page.request.get("/api/state")).json();
  expect(saved.state.tasks[0].user_id).toBe(saved.state.profile.user_id);
  expect(saved.state.profile.user_id).not.toBe(original.profile.user_id);
  const repeat = await page.request.post("/api/import", {
    headers: { Origin: "http://127.0.0.1:3102" },
    multipart: {
      revision: String(saved.state.revision),
      file: {
        name: "again.zip",
        mimeType: "application/zip",
        buffer: Buffer.from(archive),
      },
    },
  });
  expect(repeat.status()).toBe(409);
  await page.getByRole("button", { name: "+1 Kaffee", exact: true }).click();
  await page.getByLabel("Kalorien · Tageswert", { exact: true }).fill("1840");
  await page
    .getByRole("button", { name: "Kalorien speichern", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Fokusblock starten", exact: true })
    .click();
  await page.reload();
  await expect(page.getByText(/^Kaffee 1 \/ 3/)).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Kalorien 1.840 / 2.500 kcal",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Fokus pausieren", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Fokus beenden", exact: true })
    .click();
  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page).toHaveURL(/login/);
  expect((await page.request.get("/api/state")).status()).toBe(401);
  expect(
    (
      await page.request.post("/api/auth", {
        headers: { Origin: "http://127.0.0.1:3102" },
        data: {
          action: "setup",
          email: "owner@example.invalid",
          password: "cloud-fixture-password-2026",
        },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post("/api/auth", {
        headers: { Origin: "http://127.0.0.1:3102" },
        data: {
          action: "login",
          email: "other@example.invalid",
          password: "cloud-fixture-password-2026",
        },
      })
    ).status(),
  ).toBe(401);
});
