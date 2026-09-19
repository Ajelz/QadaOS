"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import type { Location } from "@/domain/prayerDay";

const inputCls = "brut-sm rounded-[8px] bg-paper px-2.5 py-2 text-[13px] font-bold w-full";

function deviceTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** GPS, a city search (OpenStreetMap Nominatim), or manual coordinates. */
export function LocationPicker({ value, onChange }: { value?: Location; onChange: (loc: Location | undefined) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ label: string; lat: number; lng: number }[]>([]);
  const [busy, setBusy] = useState<"gps" | "search" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState(false);

  async function useGps() {
    setError(null);
    setBusy("gps");
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 15000, maximumAge: 600000 }));
      onChange({ lat: Number(pos.coords.latitude.toFixed(4)), lng: Number(pos.coords.longitude.toFixed(4)), tz: deviceTz(), label: "Current location" });
    } catch {
      setError("Location was not available. Search for your city or enter coordinates.");
    } finally {
      setBusy(null);
    }
  }

  async function search() {
    if (!query.trim()) return;
    setError(null);
    setBusy("search");
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`, { headers: { accept: "application/json" } });
      const rows = (await res.json()) as { display_name: string; lat: string; lon: string }[];
      setResults(rows.map((r) => ({ label: r.display_name.split(",").slice(0, 2).join(",").trim(), lat: Number(r.lat), lng: Number(r.lon) })));
      if (rows.length === 0) setError("No places matched. Try a bigger nearby city.");
    } catch {
      setError("Search needs a connection. Use GPS or enter coordinates.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {value ? (
        <div className="flex items-center justify-between gap-2">
          <Chip tone="teal" className="max-w-[70%] truncate">
            {value.label ?? `${value.lat}, ${value.lng}`}
          </Chip>
          <button type="button" className="text-[12px] font-extrabold underline" onClick={() => onChange(undefined)}>
            Clear
          </button>
        </div>
      ) : (
        <p className="text-[12px] font-semibold text-mute">Without a location the app has no prayer windows: daily prayers become plain checkboxes.</p>
      )}

      <Button block onClick={useGps} disabled={busy === "gps"}>
        {busy === "gps" ? "Locating…" : "Use my location"}
      </Button>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <input id="location-search" className={inputCls} placeholder="Search a city" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Button type="submit" disabled={busy === "search"}>
          {busy === "search" ? "…" : "Search"}
        </Button>
      </form>
      {results.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {results.map((r) => (
            <button
              key={`${r.lat},${r.lng}`}
              type="button"
              className="brut-sm pressable rounded-[8px] px-2.5 py-2 text-left text-[13px] font-bold"
              onClick={() => {
                onChange({ lat: Number(r.lat.toFixed(4)), lng: Number(r.lng.toFixed(4)), tz: deviceTz(), label: r.label });
                setResults([]);
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      <button type="button" className="self-start text-[12px] font-extrabold underline" onClick={() => setManual((m) => !m)}>
        {manual ? "Hide coordinates" : "Enter coordinates"}
      </button>
      {manual && (
        <div className="grid grid-cols-3 gap-2">
          <input id="loc-lat" className={inputCls} placeholder="Latitude" inputMode="decimal" defaultValue={value?.lat} onBlur={(e) => onChange({ lat: Number(e.target.value) || 0, lng: value?.lng ?? 0, tz: value?.tz ?? deviceTz(), label: "Custom" })} />
          <input id="loc-lng" className={inputCls} placeholder="Longitude" inputMode="decimal" defaultValue={value?.lng} onBlur={(e) => onChange({ lat: value?.lat ?? 0, lng: Number(e.target.value) || 0, tz: value?.tz ?? deviceTz(), label: "Custom" })} />
          <input id="loc-tz" className={inputCls} placeholder="Timezone" defaultValue={value?.tz ?? deviceTz()} onBlur={(e) => value && onChange({ ...value, tz: e.target.value || deviceTz() })} />
        </div>
      )}
      {error && <p className="text-[12px] font-bold text-ink">{error}</p>}
      <p className="text-[11px] font-semibold text-mute">City search uses OpenStreetMap. Your timezone is taken from this device.</p>
    </div>
  );
}
