"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import type { Location } from "@/domain/prayerDay";

function deviceTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** GPS, a city search (OpenStreetMap Nominatim), or coordinates typed in and applied with a button. */
export function LocationPicker({ value, onChange }: { value?: Location; onChange: (loc: Location | undefined) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ label: string; lat: number; lng: number }[]>([]);
  const [busy, setBusy] = useState<"gps" | "search" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [lat, setLat] = useState(value ? String(value.lat) : "");
  const [lng, setLng] = useState(value ? String(value.lng) : "");
  const [tz, setTz] = useState(value?.tz ?? deviceTz());

  async function useGps() {
    setError(null);
    setBusy("gps");
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 15000, maximumAge: 600000 }));
      onChange({ lat: Number(pos.coords.latitude.toFixed(4)), lng: Number(pos.coords.longitude.toFixed(4)), tz: deviceTz(), label: "My location" });
    } catch {
      setError("Your location was not available. Search for your city, or enter coordinates.");
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
      if (rows.length === 0) setError("No place matched. Try a larger city nearby.");
    } catch {
      setError("Search needs a connection. Use your location or enter coordinates.");
    } finally {
      setBusy(null);
    }
  }

  const latN = Number(lat);
  const lngN = Number(lng);
  const coordsValid = lat.trim() !== "" && lng.trim() !== "" && Number.isFinite(latN) && Number.isFinite(lngN) && Math.abs(latN) <= 90 && Math.abs(lngN) <= 180 && tz.trim() !== "";

  return (
    <div className="flex flex-col gap-3">
      {value ? (
        <div className="flex items-center justify-between gap-2">
          <Chip tone="teal" className="min-w-0 max-w-full shrink overflow-hidden">
            <span className="truncate">{value.label ?? `${value.lat}, ${value.lng}`}</span>
          </Chip>
          <button type="button" className="min-h-[44px] shrink-0 px-1 text-[13px] font-extrabold underline" onClick={() => onChange(undefined)}>
            Remove
          </button>
        </div>
      ) : (
        <p className="text-[13px] font-semibold text-mute">Without a location there are no prayer times: the five daily prayers become simple checkboxes and nothing is ever marked pending.</p>
      )}

      <Button block onClick={useGps} disabled={busy === "gps"}>
        {busy === "gps" ? "Finding you…" : "Use my location"}
      </Button>

      <form
        className="flex gap-2"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <input id="location-search" type="search" aria-label="Search for a city" className="min-w-0 flex-1" placeholder="Or search a city" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Button type="submit" disabled={busy === "search" || !query.trim()}>
          {busy === "search" ? "…" : "Search"}
        </Button>
      </form>
      {results.length > 0 && (
        <ul className="flex flex-col gap-2">
          {results.map((r) => (
            <li key={`${r.lat},${r.lng}`}>
              <button
                type="button"
                className="brut-sm pressable min-h-[44px] w-full rounded-[var(--r-sm)] px-3 py-2 text-left text-[15px] font-bold"
                onClick={() => {
                  onChange({ lat: Number(r.lat.toFixed(4)), lng: Number(r.lng.toFixed(4)), tz: deviceTz(), label: r.label });
                  setResults([]);
                  setQuery("");
                }}
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" aria-expanded={manual} className="min-h-[44px] self-start text-[13px] font-extrabold underline" onClick={() => setManual((m) => !m)}>
        {manual ? "Hide coordinates" : "Enter coordinates instead"}
      </button>
      {manual && (
        <div className="grid grid-cols-2 gap-2">
          <label className="flex min-w-0 flex-col gap-1 text-[13px] font-bold">
            Latitude
            <input id="loc-lat" inputMode="decimal" placeholder="24.7136" value={lat} onChange={(e) => setLat(e.target.value)} className="w-full" />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-[13px] font-bold">
            Longitude
            <input id="loc-lng" inputMode="decimal" placeholder="46.6753" value={lng} onChange={(e) => setLng(e.target.value)} className="w-full" />
          </label>
          <label className="col-span-2 flex min-w-0 flex-col gap-1 text-[13px] font-bold">
            Timezone
            <input id="loc-tz" placeholder="Asia/Riyadh" value={tz} onChange={(e) => setTz(e.target.value)} className="w-full" />
          </label>
          <Button id="loc-apply" className="col-span-2" disabled={!coordsValid} onClick={() => onChange({ lat: Number(latN.toFixed(4)), lng: Number(lngN.toFixed(4)), tz: tz.trim(), label: `${latN.toFixed(2)}, ${lngN.toFixed(2)}` })}>
            Use these coordinates
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-[var(--r-sm)] border-[length:var(--bw)] border-ink bg-ink px-3 py-2 text-[13px] font-bold text-cream">
          {error}
        </p>
      )}
      <p className="text-[11px] font-semibold text-mute">City search uses OpenStreetMap. Your timezone comes from this device.</p>
    </div>
  );
}
