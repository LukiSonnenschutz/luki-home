import { requireUser } from "@/lib/auth";
import { readState } from "@/lib/storage";
import { exportState } from "@/lib/export";
import { localClock } from "@/lib/time";
import { errorResponse } from "@/lib/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const uid = await requireUser(request);
    const state = await readState(uid);
    const now = new Date();
    const archive = await exportState(state, now);
    return new Response(new Uint8Array(archive), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="luki-home-export-${localClock(now, state.profile.timezone).date}.zip"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
