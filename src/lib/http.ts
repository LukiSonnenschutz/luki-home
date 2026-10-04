import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "./auth";
export function errorResponse(e: unknown) {
  if (e instanceof HttpError)
    return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof ZodError)
    return NextResponse.json(
      { error: "Bitte prüfe deine Eingaben.", fields: e.flatten().fieldErrors },
      { status: 400 },
    );
  console.error(e);
  return NextResponse.json(
    { error: "Speichern fehlgeschlagen. Deine Eingaben bleiben erhalten." },
    { status: 500 },
  );
}
export async function body(request: Request) {
  const text = await request.text();
  if (text.length > 30_000)
    throw new HttpError(413, "Die Anfrage ist zu groß.");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Ungültige Anfrage.");
  }
}
