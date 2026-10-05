import "server-only";
import { storageMode } from "./config";
import { supabase } from "./supabase";
import { HttpError } from "./auth";
import type { State } from "./model";
import { upgradeState } from "./stability";
function cloudError(error: { code?: string; message: string }) {
  if (error.code === "40001")
    throw new HttpError(
      409,
      "Die Daten wurden inzwischen geändert. Bitte den aktuellen Stand prüfen und erneut speichern.",
    );
  console.error("Supabase operation failed:", error.code);
  throw new HttpError(
    503,
    "Online-Speicherung ist derzeit nicht verfügbar. Deine Eingaben bleiben erhalten.",
  );
}
export async function readState(userId: string): Promise<State> {
  if (storageMode() === "local")
    return (await import("./db")).readState(userId);
  const { data, error } = await (
    await supabase()
  ).rpc("luki_home_get_state_v2");
  if (error) cloudError(error);
  const state = data as State;
  if (!state || state.profile.user_id !== userId)
    throw new HttpError(403, "Ungültige Profilzuordnung.");
  return upgradeState(state);
}
export async function updateState<T>(
  userId: string,
  fn: (state: State) => T,
  retryRead = false,
): Promise<{ state: State; result: T }> {
  if (storageMode() === "local")
    return (await import("./db")).updateState(userId, fn);
  for (let attempt = 0; attempt < 3; attempt++) {
    const state = await readState(userId);
    const before = JSON.stringify(state);
    const revision = state.revision;
    const result = fn(state);
    if (JSON.stringify(state) === before) return { state, result };
    const { error } = await (
      await supabase()
    ).rpc("luki_home_save_state_v2", { p_state: state, p_revision: revision });
    if (error) {
      if (error.code === "40001" && retryRead && attempt < 2) continue;
      cloudError(error);
    }
    state.revision = revision + 1;
    return { state, result };
  }
  throw new HttpError(409, "Bitte erneut laden.");
}
