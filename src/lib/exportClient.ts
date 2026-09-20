"use client";

import type { LedgerEvent } from "@/domain/ledger";
import type { SettingsDoc } from "@/domain/schemas";
import { dailyTotals } from "@/domain/strategy";

/**
 * Exports are built on the device from the local ledger, so they work offline and while
 * signed out. The file is handed to the browser as a download.
 */
function download(name: string, mime: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

export function exportJson(events: LedgerEvent[], settings: SettingsDoc) {
  download(`qadaos-export-${stamp()}.json`, "application/json", JSON.stringify({ format: "qadaos-export", version: 1, exportedAt: new Date().toISOString(), settings, events }, null, 2));
}

export function exportCsv(events: LedgerEvent[]) {
  const rows = dailyTotals(events);
  const lines = ["day,owed_at_end_of_day,qada_logged,daily_prayers_missed", ...rows.map((r) => `${r.day},${r.owed},${r.qada},${r.missed}`)];
  download(`qadaos-daily-totals-${stamp()}.csv`, "text/csv", lines.join("\n") + "\n");
}
