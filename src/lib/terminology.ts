import { useMemo } from 'react';
import { useLocationList } from '@/features/locations/useLocations';
import { useAuth } from '@/lib/auth';

export interface Terminology {
  bin: string;
  bins: string;
  Bin: string;
  Bins: string;
  location: string;
  locations: string;
  Location: string;
  Locations: string;
  area: string;
  areas: string;
  Area: string;
  Areas: string;
}

export const DEFAULT_TERMINOLOGY: Terminology = {
  bin: 'bin',
  bins: 'bins',
  Bin: 'Bin',
  Bins: 'Bins',
  location: 'location',
  locations: 'locations',
  Location: 'Location',
  Locations: 'Locations',
  area: 'area',
  areas: 'areas',
  Area: 'Area',
  Areas: 'Areas',
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Parse pipe-delimited "singular|plural" term, falling back to defaults */
function parseTerm(raw: string, defaultSingular: string, defaultPlural: string): { singular: string; plural: string } {
  if (!raw) return { singular: defaultSingular, plural: defaultPlural };
  const parts = raw.split('|');
  const singular = parts[0]?.trim() || defaultSingular;
  const plural = parts[1]?.trim() || defaultPlural;
  return { singular, plural };
}

export function useTerminology(): Terminology {
  const { activeLocationId } = useAuth();
  const { locations } = useLocationList();

  return useMemo(() => {
    const loc = locations.find((l) => l.id === activeLocationId);
    if (!loc) return DEFAULT_TERMINOLOGY;

    const bin = parseTerm(loc.term_bin, 'bin', 'bins');
    const location = parseTerm(loc.term_location, 'location', 'locations');
    const area = parseTerm(loc.term_area, 'area', 'areas');

    return {
      bin: bin.singular,
      bins: bin.plural,
      Bin: capitalize(bin.singular),
      Bins: capitalize(bin.plural),
      location: location.singular,
      locations: location.plural,
      Location: capitalize(location.singular),
      Locations: capitalize(location.plural),
      area: area.singular,
      areas: area.plural,
      Area: capitalize(area.singular),
      Areas: capitalize(area.plural),
    };
  }, [activeLocationId, locations]);
}
