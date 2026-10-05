import { test, expect } from "@playwright/test";
test("0.2: Ziele, gemeinsame Aufgaben, Tageswerte, persistenter Tracker und mobile Ansicht", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill("test@example.invalid");
  await page
    .getByLabel("Passwort", { exact: true })
    .fill("only-for-isolated-test-2026");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Lukas/ })).toBeVisible();
  await page.getByRole("button", { name: "Ziele", exact: true }).click();
  await page.getByRole("button", { name: "Neues Ziel", exact: true }).click();
  await page
    .getByLabel("Titel", { exact: true })
    .fill("Hüfte langfristig belastbar bekommen");
  await page.getByLabel("Warum ist dir das wichtig?").fill("Frei bewegen");
  await page
    .getByLabel("Woran erkennst du den Erfolg?")
    .fill("Alltagsbewegung wird möglich");
  await page.getByLabel("Fokus-Ziel", { exact: true }).check();
  await page
    .getByRole("button", { name: "Ziel speichern", exact: true })
    .click();
  await page.getByRole("link", { name: "Ziel öffnen →" }).click();
  await expect(page).toHaveURL(/goals\//);
  await expect(
    page.getByRole("heading", {
      name: "Hüfte langfristig belastbar bekommen",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ziel bearbeiten", exact: true })
    .click();
  await page
    .getByLabel("Warum ist dir das wichtig?")
    .fill("Frei bewegen und aktiv bleiben");
  await page
    .getByRole("button", { name: "Ziel speichern", exact: true })
    .click();
  await expect(
    page.getByText("Frei bewegen und aktiv bleiben", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Fokus entfernen", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Als Fokus markieren", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Als Fokus markieren", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Fokus entfernen", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Meilenstein-Titel").fill("Beratung vereinbaren");
  await page.getByRole("button", { name: "Meilenstein hinzufügen" }).click();
  const milestoneCheckbox = page
    .getByText("Beratung vereinbaren", { exact: true })
    .locator("..")
    .locator("..")
    .getByRole("checkbox");
  await milestoneCheckbox.click();
  await expect(milestoneCheckbox).toBeChecked();
  await page.getByRole("button", { name: "Neue Aufgabe", exact: true }).click();
  await page
    .getByLabel("Was möchtest du erledigen?")
    .fill("Orthopäden kontaktieren");
  await page
    .getByRole("button", { name: "Aufgabe speichern", exact: true })
    .click();
  await expect(
    page.getByText("Orthopäden kontaktieren", { exact: true }),
  ).toHaveCount(2);
  await page
    .getByRole("button", {
      name: "Orthopäden kontaktieren bearbeiten",
      exact: true,
    })
    .click();
  await page.getByLabel("Notiz", { exact: true }).fill("Kontaktdaten prüfen");
  await page
    .getByRole("button", { name: "Aufgabe speichern", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Orthopäden kontaktieren: erledigen",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Welche kleine Aufgabe bringt dich weiter?", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Orthopäden kontaktieren: wieder öffnen",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Neue Aufgabe", exact: true }).click();
  await page.getByLabel("Was möchtest du erledigen?").fill("Disposable Task");
  await page
    .getByRole("button", { name: "Aufgabe speichern", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Disposable Task bearbeiten", exact: true })
    .click();
  await page.getByRole("button", { name: "Löschen", exact: true }).click();
  await page
    .getByRole("button", { name: "Endgültig löschen", exact: true })
    .click();
  await expect(page.getByText("Disposable Task", { exact: true })).toHaveCount(
    0,
  );
  for (const status of ["paused", "achieved", "discarded", "active"]) {
    await page.getByLabel("Zielstatus", { exact: true }).selectOption(status);
    await expect(page.getByLabel("Zielstatus", { exact: true })).toHaveValue(
      status,
    );
  }
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Hüfte langfristig belastbar bekommen",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Heute", exact: true }).click();
  await page
    .getByRole("button", { name: "Check-in ansehen", exact: true })
    .click();
  await page.getByLabel("Bewegung erledigt", { exact: true }).check();
  await page.getByLabel("Feierabend eingehalten", { exact: true }).check();
  await page
    .getByRole("button", { name: "Check-in abschließen", exact: true })
    .click();
  await page.getByRole("button", { name: "+1 Kaffee", exact: true }).click();
  await page.getByRole("button", { name: "+1 Kaffee", exact: true }).click();
  await expect(page.getByText(/^Kaffee 2 \/ 3/)).toBeVisible();
  await page.getByLabel("Kalorien · Tageswert", { exact: true }).fill("1840");
  await page
    .getByRole("button", { name: "Kalorien speichern", exact: true })
    .click();
  await page.getByLabel("Protein · Tageswert", { exact: true }).fill("128");
  await page
    .getByRole("button", { name: "Protein speichern", exact: true })
    .click();
  await page.getByLabel("Bewegung · Tageswert", { exact: true }).fill("25");
  await page
    .getByRole("button", { name: "Bewegung speichern", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Training-Status", exact: true })
    .selectOption("planned");
  await page
    .getByRole("button", { name: "Fokusblock starten", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Fokus pausieren", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Fokus pausieren", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Fokus fortsetzen", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Aufgaben", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Heute", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Fokus fortsetzen", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/^Kaffee 2 \/ 3/)).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Kalorien 1.840 / 2.500 kcal",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Training-Status", exact: true }),
  ).toHaveValue("planned");
  await page
    .getByRole("button", { name: "Fokus fortsetzen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Fokus beenden", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Pause starten", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Pause beenden", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Echte Pause", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Pause beenden", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Einstellungen", exact: true })
    .click();
  await page.getByLabel("Kaffee-Cutoff", { exact: true }).fill("00:00");
  await page.getByLabel("Fokusblock · Minuten", { exact: true }).fill("60");
  await page.getByLabel("Pause · Minuten", { exact: true }).fill("10");
  await page
    .getByRole("combobox", { name: "Theme", exact: true })
    .selectOption("light");
  const settingsSaved = page.waitForResponse(
    (r) => r.url().endsWith("/api/state") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Einstellungen speichern", exact: true })
    .click();
  expect((await settingsSaved).status()).toBe(200);
  await page.reload();
  await page
    .getByRole("button", { name: "Einstellungen", exact: true })
    .click();
  await expect(
    page.getByLabel("Fokusblock · Minuten", { exact: true }),
  ).toHaveValue("60");
  await page.getByRole("button", { name: "Heute", exact: true }).click();
  await expect(
    page.getByText("Dein Kaffee-Zeitfenster ist für heute beendet.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.setViewportSize({ width: 360, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/v02-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.screenshot({
    path: "test-results/v02-desktop.png",
    fullPage: true,
  });
  const state = await (await page.request.get("/api/state")).json();
  expect(
    state.state.tasks.find(
      (t: { title: string }) => t.title === "Orthopäden kontaktieren",
    ).goal_id,
  ).toBe(state.state.goals[0].id);
  expect(state.state.work_sessions[0].status).toBe("done");
  expect(
    state.state.daily_metrics.find(
      (m: { metric_type: string }) => m.metric_type === "calories",
    ).value,
  ).toBe(1840);
});
