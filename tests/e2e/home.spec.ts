import { test, expect } from "@playwright/test";
import JSZip from "jszip";
import { readFile } from "node:fs/promises";
const credentials = {
  email: "test@example.invalid",
  password: "only-for-isolated-test-2026",
  name: "Lukas",
};
test("Privater Zugriff, kompletter Tagesablauf, Export und mobile Darstellung", async ({
  page,
  request,
}) => {
  expect((await request.get("/api/state")).status()).toBe(401);
  expect((await request.get("/api/export")).status()).toBe(401);
  expect(
    (
      await request.post("/api/auth", {
        data: { action: "setup", ...credentials },
      })
    ).status(),
  ).toBe(403);
  await page.goto("/");
  await expect(page).toHaveURL(/login/);
  await page.getByLabel("Dein Name").fill("Lukas");
  await page.getByLabel("E-Mail").fill(credentials.email);
  await page.getByLabel("Passwort", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Luki Home einrichten" }).click();
  await expect(page.getByRole("heading", { name: /Lukas/ })).toBeVisible();
  await page.getByRole("button", { name: "Fokus setzen", exact: true }).click();
  await page
    .getByLabel("Tagesfokus", { exact: true })
    .fill("Angebot fertigstellen");
  await page.getByLabel("Training · optionale Tagesnotiz").fill("Upper A");
  await page.getByLabel("Uhrzeit · optional", { exact: true }).fill("18:00");
  await page.getByRole("button", { name: "Plan speichern" }).click();
  await expect(
    page.getByRole("heading", { name: "Angebot fertigstellen" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Aufgaben", exact: true }).click();
  await page.getByRole("button", { name: "Neue Aufgabe" }).click();
  await page.getByLabel("Was möchtest du erledigen?").fill("Angebot prüfen");
  await page.getByRole("button", { name: "Aufgabe speichern" }).click();
  await expect(page.getByText("Angebot prüfen", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Angebot prüfen: hervorheben" })
    .click();
  await expect(
    page.getByRole("button", { name: "Angebot prüfen: Priorität entfernen" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Heute", exact: true }).click();
  await page.getByRole("button", { name: "Aufstehen: erledigen" }).click();
  await expect(
    page.getByRole("button", { name: "Aufstehen: wieder öffnen" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Check-in öffnen", exact: true })
    .click();
  await page.getByRole("button", { name: "Check-in abschließen" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Bewertungen",
  );
  await page.locator('input[name="energy"][value="4"]').check({ force: true });
  await page.locator('input[name="mood"][value="4"]').check({ force: true });
  await page.locator('input[name="stress"][value="2"]').check({ force: true });
  await page
    .getByLabel("Was hat heute geholfen?")
    .fill("Eine ruhige Morgenroutine.");
  await page.getByRole("button", { name: "Check-in abschließen" }).click();
  await expect(
    page.getByRole("heading", { name: "Dein Tag ist festgehalten." }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Angebot fertigstellen" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Aufstehen: wieder öffnen" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(page.getByRole("heading", { name: /Lukas/ })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/dashboard-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Einstellungen", exact: true })
    .click();
  await page.getByLabel("Feierabendziel", { exact: true }).fill("16:30");
  const settingsSaved = page.waitForResponse(
    (r) => r.url().endsWith("/api/state") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Einstellungen speichern" }).click();
  expect((await settingsSaved).status()).toBe(200);
  await page.getByRole("button", { name: "Heute", exact: true }).click();
  await expect(page.getByText("Ziel 16:30", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Einstellungen", exact: true })
    .click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("link", { name: "Daten exportieren", exact: true })
    .last()
    .click();
  const download = await downloadPromise;
  const zip = await JSZip.loadAsync(await readFile((await download.path())!));
  const tasks = JSON.parse(await zip.file("tasks.json")!.async("string"));
  expect(tasks).toHaveLength(1);
  expect(tasks[0].title).toBe("Angebot prüfen");
  const checkins = JSON.parse(await zip.file("checkins.json")!.async("string"));
  expect(checkins[0].stress).toBe(2);
  expect(checkins[0].submitted_at).toBeTruthy();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page).toHaveURL(/login/);
  await page.getByLabel("E-Mail").fill(credentials.email);
  await page.getByLabel("Passwort", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Lukas/ })).toBeVisible();
});
test("Konflikte und falsche Eingaben überschreiben keine gespeicherten Daten", async ({
  request,
}) => {
  const login = await request.post("/api/auth", {
    headers: { Origin: "http://127.0.0.1:3101" },
    data: { action: "login", ...credentials },
  });
  expect(login.status()).toBe(200);
  const data = await (await request.get("/api/state")).json();
  const c = {
    type: "task-create",
    date: data.date,
    title: "Konflikttest",
    notes: "",
    due_date: null,
    revision: data.state.revision,
  };
  expect(
    (
      await request.post("/api/state", {
        headers: { Origin: "http://127.0.0.1:3101" },
        data: c,
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.post("/api/state", {
        headers: { Origin: "http://127.0.0.1:3101" },
        data: c,
      })
    ).status(),
  ).toBe(409);
  const fresh = await (await request.get("/api/state")).json();
  expect(
    fresh.state.tasks.filter(
      (t: { title: string }) => t.title === "Konflikttest",
    ),
  ).toHaveLength(1);
  expect(
    (
      await request.post("/api/state", {
        headers: { Origin: "https://evil.invalid" },
        data: { ...c, revision: fresh.state.revision },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/auth", {
        headers: { Origin: "http://127.0.0.1:3101" },
        data: { action: "setup", ...credentials },
      })
    ).status(),
  ).toBe(403);
});
