"use client";

import { useEffect, useState } from "react";

import { FormField } from "@/components/dashboard/form-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listPathaoAreas,
  listPathaoCities,
  listPathaoZones,
  type PathaoLocation,
} from "@/lib/api/integration-credentials";
import { getErrorMessage } from "@/lib/api/types";

export interface PathaoLocationValue {
  cityId: number | null;
  zoneId: number | null;
  areaId: number | null;
}

export const EMPTY_PATHAO_LOCATION: PathaoLocationValue = {
  cityId: null,
  zoneId: null,
  areaId: null,
};

/** Pathao's own real minimum — confirmed by a live "must be at least 10
 * characters" rejection of a too-short recipient_address. Checked
 * client-side so a live dispatch doesn't fail a round trip to Pathao just
 * to report this. */
export const MIN_PATHAO_ADDRESS_LENGTH = 10;

/** Cascading City → Zone → Area picker backed by Pathao's live location
 * lists — shared by the Add Delivery dialog and the Send Gift courier
 * section so both dispatch against the same real Pathao area IDs. */
export function PathaoLocationPicker({
  value,
  onChange,
  disabled,
}: {
  value: PathaoLocationValue;
  onChange: (value: PathaoLocationValue) => void;
  disabled?: boolean;
}) {
  const [cities, setCities] = useState<PathaoLocation[]>([]);
  const [zones, setZones] = useState<PathaoLocation[]>([]);
  const [areas, setAreas] = useState<PathaoLocation[]>([]);
  const [loadingCities, setLoadingCities] = useState(true);
  const [loadingZones, setLoadingZones] = useState(false);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(async () => {
        setLoadingCities(true);
        try {
          const result = await listPathaoCities();
          if (!cancelled) setCities(result);
        } finally {
          if (!cancelled) setLoadingCities(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err, "Unable to load Pathao cities."));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(async () => {
        if (!value.cityId) {
          if (!cancelled) setZones([]);
          return;
        }
        setLoadingZones(true);
        try {
          const result = await listPathaoZones(value.cityId);
          if (!cancelled) setZones(result);
        } finally {
          if (!cancelled) setLoadingZones(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err, "Unable to load Pathao zones."));
      });
    return () => {
      cancelled = true;
    };
  }, [value.cityId]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(async () => {
        if (!value.zoneId) {
          if (!cancelled) setAreas([]);
          return;
        }
        setLoadingAreas(true);
        try {
          const result = await listPathaoAreas(value.zoneId);
          if (!cancelled) setAreas(result);
        } finally {
          if (!cancelled) setLoadingAreas(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err, "Unable to load Pathao areas."));
      });
    return () => {
      cancelled = true;
    };
  }, [value.zoneId]);

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField htmlFor="pathao-picker-city" label="City">
          <Select
            value={value.cityId ? String(value.cityId) : ""}
            onValueChange={(v) =>
              onChange({ cityId: Number(v), zoneId: null, areaId: null })
            }
            disabled={disabled || loadingCities}
          >
            <SelectTrigger id="pathao-picker-city" className="w-full">
              <SelectValue placeholder={loadingCities ? "Loading…" : "Select city"} />
            </SelectTrigger>
            <SelectContent>
              {cities.map((city) => (
                <SelectItem key={city.id} value={String(city.id)}>
                  {city.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField htmlFor="pathao-picker-zone" label="Zone">
          <Select
            value={value.zoneId ? String(value.zoneId) : ""}
            onValueChange={(v) => onChange({ ...value, zoneId: Number(v), areaId: null })}
            disabled={disabled || !value.cityId || loadingZones}
          >
            <SelectTrigger id="pathao-picker-zone" className="w-full">
              <SelectValue
                placeholder={
                  loadingZones ? "Loading…" : !value.cityId ? "Select city first" : "Select zone"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {zones.map((zone) => (
                <SelectItem key={zone.id} value={String(zone.id)}>
                  {zone.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField htmlFor="pathao-picker-area" label="Area">
          <Select
            value={value.areaId ? String(value.areaId) : ""}
            onValueChange={(v) => onChange({ ...value, areaId: Number(v) })}
            disabled={disabled || !value.zoneId || loadingAreas}
          >
            <SelectTrigger id="pathao-picker-area" className="w-full">
              <SelectValue
                placeholder={
                  loadingAreas ? "Loading…" : !value.zoneId ? "Select zone first" : "Select area"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {areas.map((area) => (
                <SelectItem key={area.id} value={String(area.id)}>
                  {area.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
