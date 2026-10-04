import { NextResponse } from "next/server";
import { assertOrigin, requireUser, HttpError } from "@/lib/auth";
import { updateState } from "@/lib/storage";
import { importArchive, isEmptyForImport } from "@/lib/import";
import { errorResponse } from "@/lib/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const uid = await requireUser(request);
    // Limit the whole multipart body before parsing or decompressing it.
    const reader = request.body?.getReader();
    if (!reader) throw new HttpError(400, "Export-Datei fehlt.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 11 * 1024 * 1024) {
        await reader.cancel();
        throw new HttpError(413, "Der Export ist zu groß.");
      }
      chunks.push(value);
    }
    const bounded = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: new Uint8Array(Buffer.concat(chunks)),
    });
    const form = await bounded.formData();
    const file = form.get("file");
    const rawRevision = form.get("revision");
    const revision = Number(rawRevision);
    if (
      !(file instanceof File) ||
      typeof rawRevision !== "string" ||
      !/^\d+$/.test(rawRevision) ||
      !Number.isSafeInteger(revision)
    )
      throw new HttpError(400, "Export-Datei oder aktueller Stand fehlt.");
    let imported;
    try {
      imported = await importArchive(
        new Uint8Array(await file.arrayBuffer()),
        uid,
      );
    } catch (e) {
      throw new HttpError(
        400,
        e instanceof Error ? e.message : "Ungültiger Export.",
      );
    }
    await updateState(uid, (s) => {
      if (s.revision !== revision)
        throw new HttpError(
          409,
          "Der Datenstand hat sich geändert. Bitte erneut laden.",
        );
      if (!isEmptyForImport(s))
        throw new HttpError(
          409,
          "Dieser Zugang enthält bereits Tagesdaten. Eine Übernahme würde sie überschreiben und wurde daher abgebrochen.",
        );
      Object.assign(s, { ...imported, revision: s.revision });
    });
    return NextResponse.json({
      ok: true,
      counts: {
        tasks: imported.tasks.length,
        days: imported.day_plans.length,
        checkins: imported.checkins.length,
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
