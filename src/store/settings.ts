import { SettingsDocSchema, type SettingsDoc } from "@/domain/schemas";
import type { QadaDatabase } from "./db";

const KEY = "settings";
const EPOCH = "1970-01-01T00:00:00.000Z";

export interface StoredSettings {
  doc: SettingsDoc;
  updatedAt: string;
}

export function defaultSettings(): SettingsDoc {
  return SettingsDocSchema.parse({});
}

export async function getLocalSettings(db: QadaDatabase): Promise<StoredSettings> {
  const stored = await db.getKV<StoredSettings>(KEY);
  if (!stored) return { doc: defaultSettings(), updatedAt: EPOCH };
  const parsed = SettingsDocSchema.safeParse(stored.doc);
  return { doc: parsed.success ? parsed.data : defaultSettings(), updatedAt: stored.updatedAt };
}

/** Save locally with a fresh timestamp. The caller schedules a server sync. */
export async function saveLocalSettings(db: QadaDatabase, doc: SettingsDoc): Promise<StoredSettings> {
  const next: StoredSettings = { doc: SettingsDocSchema.parse(doc), updatedAt: new Date().toISOString() };
  await db.setKV(KEY, next);
  return next;
}

export async function patchLocalSettings(db: QadaDatabase, patch: (doc: SettingsDoc) => SettingsDoc): Promise<StoredSettings> {
  const current = await getLocalSettings(db);
  return saveLocalSettings(db, patch(current.doc));
}

/**
 * Reconcile with the server, last-write-wins by updatedAt in both directions.
 * Returns the winning document.
 */
export async function syncSettings(db: QadaDatabase): Promise<StoredSettings> {
  const local = await getLocalSettings(db);
  const res = await fetch("/api/settings", { credentials: "same-origin" });
  if (!res.ok) throw new Error(`settings: ${res.status}`);
  const remote = (await res.json()) as { doc: unknown; updatedAt: string | null };

  if (remote.updatedAt && remote.updatedAt > local.updatedAt) {
    const parsed = SettingsDocSchema.safeParse(remote.doc);
    if (parsed.success) {
      const next = { doc: parsed.data, updatedAt: remote.updatedAt };
      await db.setKV(KEY, next);
      return next;
    }
  }

  if (local.updatedAt > (remote.updatedAt ?? EPOCH)) {
    const put = await fetch("/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(local),
    });
    if (!put.ok) throw new Error(`settings: ${put.status}`);
  }
  return local;
}
