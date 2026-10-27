import { NextResponse } from "next/server";
import { requireUser, assertOrigin, HttpError } from "@/lib/auth";
import { readState, updateState } from "@/lib/storage";
import { storageMode } from "@/lib/config";
import { dateSchema, commandSchema } from "@/lib/model";
import { localClock } from "@/lib/time";
import { applyCommand, evaluateRules } from "@/lib/domain";
import { projectDashboard } from "@/lib/dashboard";
import { body, errorResponse } from "@/lib/http";
import { expireWork } from "@/lib/stability";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const uid = await requireUser(request);
    const now = new Date();
    const stored = await readState(uid);
    const today = localClock(now, stored.profile.timezone).date;
    const date = dateSchema.parse(
      new URL(request.url).searchParams.get("date") || today,
    );
    if (date > today)
      throw new HttpError(400, "Zukünftige Tage werden noch nicht geöffnet.");
    const { state, activeRule, needsSync } = projectDashboard(
      stored,
      date,
      now,
    );
    return NextResponse.json({
      state,
      date,
      today,
      serverTime: now.toISOString(),
      activeRule,
      needsSync,
      mode: storageMode(),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const uid = await requireUser(request);
    const input = await body(request);
    const c = commandSchema.parse(input);
    const now = new Date();
    const { state, result } = await updateState(uid, (s) => {
      if (typeof input.revision !== "number" || input.revision !== s.revision)
        throw new HttpError(
          409,
          "Die Daten wurden inzwischen geändert. Der aktuelle Stand wurde geladen; bitte prüfe und speichere deine Eingabe erneut.",
        );
      if (c.date > localClock(now, s.profile.timezone).date)
        throw new HttpError(
          400,
          "Bitte einen heutigen oder früheren Tag wählen.",
        );
      try {
        if (c.type !== "work") expireWork(s, now);
        applyCommand(s, c, now);
      } catch (e) {
        throw new HttpError(
          400,
          e instanceof Error ? e.message : "Ungültige Eingabe.",
        );
      }
      return evaluateRules(s, c.date, now);
    });
    return NextResponse.json({
      state,
      date: c.date,
      today: localClock(now, state.profile.timezone).date,
      serverTime: now.toISOString(),
      activeRule: result,
      mode: storageMode(),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
