"use client";
import { useState } from "react";
import type { State } from "@/lib/model";
import { isEmptyForImport } from "@/lib/import-eligibility";
export default function ImportBackup({
  state,
  busy,
  onImport,
}: {
  state: State;
  busy: boolean;
  onImport: (file: File) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  return (
    <div
      style={{
        marginTop: 24,
        paddingTop: 20,
        borderTop: "1px solid var(--border)",
      }}
    >
      <h3>Lokale Daten übernehmen</h3>
      <p className="muted small">
        Wähle deinen ZIP-Export von Luki Home. Die Übernahme enthält auch Profil
        und Einstellungen und ist nur möglich, solange dieser Online-Zugang noch
        keine eigenen Tagesdaten enthält.
      </p>
      {isEmptyForImport(state) ? (
        <>
          <label>
            Luki-Home-Export (.zip)
            <input
              type="file"
              accept=".zip,application/zip"
              disabled={busy}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
          <button
            type="button"
            className="secondary"
            disabled={busy || !file}
            onClick={() => {
              if (file) void onImport(file);
            }}
          >
            Lokalen Export übernehmen
          </button>
        </>
      ) : (
        <p className="small muted">
          Dieser Zugang enthält bereits Daten. Ein überschreibender Import ist
          gesperrt.
        </p>
      )}
    </div>
  );
}
