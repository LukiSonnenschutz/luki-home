import { test, expect, type Page } from "@playwright/test";
async function login(page: Page) {
  page.setDefaultTimeout(8000);
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill("test@example.invalid");
  await page
    .getByLabel("Passwort", { exact: true })
    .fill("only-for-isolated-test-2026");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Lukas/ })).toBeVisible();
}
async function save(page: Page, name: string) {
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/api/state") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name, exact: true }).click();
  const r = await response;
  expect(r.status(), await r.text()).toBe(200);
  await expect(page.getByText("Speichert …", { exact: true })).toHaveCount(0);
}
test("0.3: Pläne A/B, Vorlage, echte Satzwerte, Historie, flexible Planung und mobile Trainingsansicht", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await page.getByRole("button", { name: "Training", exact: true }).click();
  for (const name of ["Plan A", "Plan B"]) {
    await page.getByRole("button", { name: "Neuer Plan", exact: true }).click();
    await page.getByLabel("Planname", { exact: true }).fill(name);
    await save(page, "Plan speichern");
  }
  await page.getByRole("button", { name: "Neue Vorlage", exact: true }).click();
  await page.getByLabel("Workoutname", { exact: true }).fill("Upper A");
  await page
    .getByRole("combobox", { name: "Trainingsplan", exact: true })
    .selectOption({ label: "Plan A" });
  await save(page, "Vorlage speichern");
  await page.getByRole("button", { name: "Upper A", exact: true }).click();
  await page
    .getByRole("button", { name: "Übung hinzufügen", exact: true })
    .click();
  await page.getByLabel("Übungsname", { exact: true }).fill("Bankdrücken");
  await page.getByLabel("Wiederholungen von", { exact: true }).fill("6");
  await page.getByLabel("Wiederholungen bis", { exact: true }).fill("8");
  await page.getByLabel("Zielgewicht", { exact: true }).fill("80");
  await save(page, "Übung speichern");
  await page
    .getByRole("button", { name: "Übung hinzufügen", exact: true })
    .click();
  await page.getByLabel("Übungsname", { exact: true }).fill("Run");
  await page
    .getByRole("combobox", { name: "Komponente", exact: true })
    .selectOption("run");
  await page.getByLabel("Zielrunden", { exact: true }).fill("4");
  await page.getByLabel("Zieldistanz · m", { exact: true }).fill("1000");
  await page.getByLabel("Zieldauer · Sekunden", { exact: true }).fill("300");
  await save(page, "Übung speichern");
  const run = page
    .locator(".training-row")
    .filter({ has: page.getByRole("heading", { name: "Run", exact: true }) });
  await run.getByRole("button", { name: "Nach oben", exact: true }).click();
  await expect(
    page
      .locator(".training-row")
      .filter({ has: page.getByRole("heading", { level: 3 }) })
      .last(),
  ).toContainText("Bankdrücken");
  await page
    .getByRole("button", { name: "Upper A Workout starten", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Run", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Runde 1 Distanz", { exact: true }).fill("800");
  await page.getByLabel("Runde 1 Dauer", { exact: true }).fill("270");
  await save(page, "Satz 1 speichern");
  await page
    .getByRole("button", { name: "Nächste Übung", exact: true })
    .click();
  await page.getByLabel("Satz 1 Gewicht", { exact: true }).fill("80");
  await page.getByLabel("Satz 1 Wiederholungen", { exact: true }).fill("8");
  await page.getByLabel("Satz 2 Gewicht", { exact: true }).fill("77");
  await save(page, "Satz 1 speichern");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("button", { name: "Vorherige Übung", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Bankdrücken", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Satz 2 Gewicht", { exact: true })).toHaveValue(
    "77",
  );
  for (let i = 1; i <= 3; i++) {
    await page.getByLabel(`Satz ${i} Gewicht`, { exact: true }).fill("80");
    await page
      .getByLabel(`Satz ${i} Wiederholungen`, { exact: true })
      .fill(i === 3 ? "7" : "8");
    await save(page, `Satz ${i} speichern`);
  }
  await page.setViewportSize({ width: 360, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/v03-workout-mobile.png",
    fullPage: true,
  });
  await page
    .getByLabel("Session-Notiz", { exact: true })
    .fill("Drei Sätze und Run");
  await save(page, "Training beenden");
  await expect(
    page.getByText("80 kg × 7 Wdh.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Pläne & Vorlagen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Upper A Workout starten", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Nächste Übung", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Letzte Einheit", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".previous-values")).toContainText(
    "80 kg × 7 Wdh.",
  );
  await page
    .getByRole("button", { name: "Bankdrücken ändern", exact: true })
    .click();
  await page.getByLabel("Übungsname", { exact: true }).fill("Kabeldrücken");
  await page
    .getByRole("combobox", { name: "Änderung anwenden", exact: true })
    .selectOption("session");
  await save(page, "Übung speichern");
  await expect(
    page.getByRole("heading", { name: "Kabeldrücken", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Kabeldrücken ändern", exact: true })
    .click();
  await page.getByLabel("Übungsname", { exact: true }).fill("Schrägbank");
  await page
    .getByRole("combobox", { name: "Änderung anwenden", exact: true })
    .selectOption("both");
  await save(page, "Übung speichern");
  await save(page, "Training beenden");
  await page.getByLabel("Übungshistorie", { exact: true }).fill("Bankdrücken");
  await expect(
    page.getByRole("heading", { name: "Bankdrücken", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Schrägbank", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Planung", exact: true }).click();
  const day = "2026-10-08";
  await page
    .getByRole("combobox", { name: "Training wählen", exact: true })
    .selectOption({ label: "Upper A" });
  await page.getByLabel("Trainingstag", { exact: true }).fill(day);
  await save(page, "Training einplanen");
  await page.getByLabel("Verschieben auf", { exact: true }).fill("2026-10-09");
  await save(page, "Termin speichern");
  await page.reload();
  await page.getByRole("button", { name: "Training", exact: true }).click();
  await page.getByRole("button", { name: "Planung", exact: true }).click();
  await expect(page.getByLabel("Verschieben auf", { exact: true })).toHaveValue(
    "2026-10-09",
  );
  await page
    .getByRole("button", { name: "Einstellungen", exact: true })
    .click();
  await page.getByLabel("Trainingsmodul aktiv", { exact: true }).uncheck();
  await save(page, "Einstellungen speichern");
  await expect(
    page.getByRole("button", { name: "Training", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Trainingsmodul aktiv", { exact: true }).check();
  await save(page, "Einstellungen speichern");
  await page.getByRole("button", { name: "Training", exact: true }).click();
  await page
    .getByRole("button", { name: "Trainingshistorie", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Bankdrücken", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.screenshot({
    path: "test-results/v03-history-desktop.png",
    fullPage: true,
  });
  const state = (await (await page.request.get("/api/state")).json()).state;
  expect(
    state.workout_sessions.filter(
      (w: { status: string }) => w.status === "completed",
    ),
  ).toHaveLength(2);
  expect(
    state.workout_template_items.find(
      (i: { name: string }) => i.name === "Schrägbank",
    ),
  ).toBeTruthy();
  expect(
    state.workout_sets.filter((r: { reps: number }) => r.reps === 7),
  ).toHaveLength(1);
  expect(errors).toEqual([]);
});
test("0.3: HYROX mit vier freien Stationen, Drag-and-drop, Rundendaten und Snapshot nach Vorlagenänderung", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await login(page);
  await page.getByRole("button", { name: "Training", exact: true }).click();
  await page.getByRole("button", { name: "Neue Vorlage", exact: true }).click();
  await page.getByLabel("Workoutname", { exact: true }).fill("Upper B");
  await page
    .getByRole("combobox", { name: "Trainingsplan", exact: true })
    .selectOption({ label: "Plan B" });
  await save(page, "Vorlage speichern");
  await page.getByRole("button", { name: "Neue Vorlage", exact: true }).click();
  await page.getByLabel("Workoutname", { exact: true }).fill("HYROX Prep");
  await page
    .getByRole("combobox", { name: "Trainingsart", exact: true })
    .selectOption("conditioning");
  await save(page, "Vorlage speichern");
  await page.getByRole("button", { name: "HYROX Prep", exact: true }).click();
  for (const [name, kind, distance, reps, weight] of [
    ["Run", "run", "800", "", ""],
    ["Ski", "ergometer", "500", "", ""],
    ["Wall Balls", "reps", "", "15", "6"],
    ["Sled Push", "station", "20", "", "80"],
  ]) {
    await page
      .getByRole("button", { name: "Übung hinzufügen", exact: true })
      .click();
    await page.getByLabel("Übungsname", { exact: true }).fill(name);
    await page
      .getByRole("combobox", { name: "Komponente", exact: true })
      .selectOption(kind);
    await page.getByLabel("Zielrunden", { exact: true }).fill("4");
    await page.getByLabel("Zieldistanz · m", { exact: true }).fill(distance);
    await page.getByLabel("Zielwiederholungen", { exact: true }).fill(reps);
    await page.getByLabel("Zielgewicht", { exact: true }).fill(weight);
    await save(page, "Übung speichern");
  }
  const row = (name: string) =>
    page
      .locator(".training-row")
      .filter({ has: page.getByRole("heading", { name, exact: true }) });
  await row("Wall Balls")
    .getByRole("button", { name: "Reihenfolge ziehen", exact: true })
    .dragTo(
      row("Run").getByRole("button", {
        name: "Reihenfolge ziehen",
        exact: true,
      }),
    );
  await expect(
    page
      .locator(".training-row")
      .filter({ has: page.getByRole("heading", { level: 3 }) })
      .first(),
  ).toContainText("Wall Balls");
  await page
    .getByRole("button", { name: "Wall Balls bearbeiten", exact: true })
    .click();
  await page.getByLabel("Zielgewicht", { exact: true }).fill("9");
  await page.getByLabel("Zielrunden", { exact: true }).fill("5");
  await save(page, "Übung speichern");
  await page
    .getByRole("button", { name: "Ski bearbeiten", exact: true })
    .click();
  await page.getByLabel("Zieldistanz · m", { exact: true }).fill("600");
  await save(page, "Übung speichern");
  await page
    .getByRole("button", { name: "Ski duplizieren", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ski · Kopie", exact: true }),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Ski · Kopie entfernen", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ski · Kopie", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "HYROX Prep Workout starten", exact: true })
    .click();
  await page.getByLabel("Satz 1 Gewicht", { exact: true }).fill("9");
  await page.getByLabel("Satz 1 Wiederholungen", { exact: true }).fill("15");
  await save(page, "Satz 1 speichern");
  await page
    .getByRole("button", { name: "Nächste Übung", exact: true })
    .click();
  await page.getByLabel("Runde 1 Distanz", { exact: true }).fill("800");
  await page.getByLabel("Runde 1 Dauer", { exact: true }).fill("270");
  await save(page, "Satz 1 speichern");
  await page
    .getByRole("button", { name: "Nächste Übung", exact: true })
    .click();
  await page.getByLabel("Runde 1 Distanz", { exact: true }).fill("600");
  await save(page, "Satz 1 speichern");
  await page
    .getByRole("button", { name: "Nächste Übung", exact: true })
    .click();
  await page.getByLabel("Satz 1 Gewicht", { exact: true }).fill("80");
  await page.getByLabel("Runde 1 Distanz", { exact: true }).fill("20");
  await save(page, "Satz 1 speichern");
  await save(page, "Training beenden");
  await page.reload();
  await page.getByRole("button", { name: "Training", exact: true }).click();
  await page
    .getByRole("button", { name: "Trainingshistorie", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Vorlagen-Historie", exact: true })
    .selectOption({ label: "HYROX Prep" });
  await expect(page.locator(".training-history")).toContainText(
    "9 kg × 15 Wdh.",
  );
  await expect(page.locator(".training-history")).toContainText("800 m");
  await expect(page.locator(".training-history")).toContainText("270 s");
  const before = (await (await page.request.get("/api/state")).json()).state;
  const history = before.workout_sessions.find(
    (w: { name_snapshot: string }) => w.name_snapshot === "HYROX Prep",
  );
  const ids = before.workout_session_items
    .filter(
      (i: { workout_session_id: string }) =>
        i.workout_session_id === history.id,
    )
    .map((i: { id: string }) => i.id);
  expect(
    before.workout_sets.filter((r: { session_item_id: string }) =>
      ids.includes(r.session_item_id),
    ),
  ).toHaveLength(17);
  await page
    .getByRole("button", { name: "Pläne & Vorlagen", exact: true })
    .click();
  await page.getByRole("button", { name: "HYROX Prep", exact: true }).click();
  await page
    .getByRole("button", { name: "Wall Balls bearbeiten", exact: true })
    .click();
  await page.getByLabel("Zielgewicht", { exact: true }).fill("12");
  await save(page, "Übung speichern");
  const after = (await (await page.request.get("/api/state")).json()).state;
  expect(
    after.workout_sessions.find((w: { id: string }) => w.id === history.id),
  ).toEqual(history);
  expect(
    after.workout_session_items.filter((i: { id: string }) =>
      ids.includes(i.id),
    ),
  ).toEqual(
    before.workout_session_items.filter((i: { id: string }) =>
      ids.includes(i.id),
    ),
  );
  await page.setViewportSize({ width: 360, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/v03-hyrox-mobile.png",
    fullPage: true,
  });
});
test("0.3: realer 15-Sekunden-Fokusblock mit Pause, Reload, Ablaufmeldung und Audioausgabe", async ({
  page,
}) => {
  test.setTimeout(60_000);
  // Instrument the real Web Audio buffer source; original connect/start still execute.
  await page.addInitScript(() => {
    const original = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (
      ...args: Parameters<typeof original>
    ) {
      const samples = this.buffer?.getChannelData(0);
      const energy = samples
        ? Array.from(samples).reduce((sum, v) => sum + v * v, 0)
        : 0;
      (window as unknown as { audioProof: number[] }).audioProof ??= [];
      (window as unknown as { audioProof: number[] }).audioProof.push(energy);
      return original.apply(this, args);
    };
  });
  await login(page);
  await page
    .getByRole("button", { name: "Einstellungen", exact: true })
    .click();
  await page.getByLabel("Fokusblock · Minuten", { exact: true }).fill("0.25");
  await page
    .getByRole("combobox", { name: "Klingelton", exact: true })
    .selectOption("digital");
  await page.getByRole("button", { name: "Ton testen", exact: true }).click();
  await expect(
    page.getByText("Ton abgespielt · digital", { exact: true }),
  ).toBeVisible();
  await save(page, "Einstellungen speichern");
  await page.getByRole("button", { name: "Heute", exact: true }).click();
  await save(page, "Fokusblock starten");
  await save(page, "Fokus pausieren");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Fokus fortsetzen", exact: true }),
  ).toBeVisible();
  await save(page, "Fokus fortsetzen");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Fokus pausieren", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Aufgaben", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Fokusblock beendet", exact: true }),
  ).toBeVisible({ timeout: 25_000 });
  await expect(
    page.getByText("Hinweiston abgespielt · digital", { exact: true }),
  ).toBeVisible();
  const audio = await page.evaluate(
    () => (window as unknown as { audioProof: number[] }).audioProof,
  );
  expect(audio.some((v) => v > 1)).toBe(true);
  await page.getByRole("button", { name: "Heute", exact: true }).click();
  const state = (await (await page.request.get("/api/state")).json()).state;
  const latest = state.work_sessions.at(-1);
  expect(latest.completed_by_timer).toBe(true);
  expect(latest.elapsed_seconds).toBe(15);
  expect(latest.status).toBe("done");
  await save(page, "Fokusblock starten");
  await save(page, "Zurücksetzen");
  const reset = (
    await (await page.request.get("/api/state")).json()
  ).state.work_sessions.at(-1);
  expect(reset.was_reset).toBe(true);
  expect(reset.status).toBe("done");
});
