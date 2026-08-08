import { POLICY } from '../policy.js';
import type { FuelType } from '../types.js';

/**
 * Emissions from primary data.
 *
 * Pooling three people into one rickshaw is a real ~66% cut in CO2e per
 * passenger-km. Being able to *prove* that with fuel receipts logged by drivers,
 * rather than asserting it from a spreadsheet, is worth far more to a city
 * transport department — and to a future funding conversation — than the ₹20 a
 * log costs.
 */

export interface EmissionFactors {
  readonly kgCo2ePerUnit: number;
  readonly kmPerUnit: number;
}

export function factorsFor(fuelType: FuelType): EmissionFactors {
  switch (fuelType) {
    case 'cng':
      return {
        kgCo2ePerUnit: POLICY.emissions.CNG_KG_CO2E_PER_KG,
        kmPerUnit: POLICY.emissions.DEFAULT_CNG_KM_PER_KG,
      };
    case 'petrol':
      return {
        kgCo2ePerUnit: POLICY.emissions.PETROL_KG_CO2E_PER_LITRE,
        kmPerUnit: POLICY.emissions.DEFAULT_PETROL_KM_PER_LITRE,
      };
    case 'electric':
      // Tailpipe zero. Grid emissions are a separate, honest conversation and
      // we do not want to overclaim, so v1 reports tank-to-wheel only.
      return { kgCo2ePerUnit: 0, kmPerUnit: 60 };
  }
}

/** Total CO2e for a measured fill. */
export function emissionsForFill(fuelType: FuelType, quantity: number): number {
  return factorsFor(fuelType).kgCo2ePerUnit * quantity;
}

/**
 * Observed efficiency from a driver's own data: distance covered between two
 * fills, divided by the fuel bought. More honest than a default, once we have
 * two logs from the same vehicle.
 */
export function observedEfficiency(kmBetweenFills: number, unitsFilled: number): number | null {
  if (unitsFilled <= 0 || kmBetweenFills <= 0) return null;
  return kmBetweenFills / unitsFilled;
}

export interface TripEmissions {
  readonly totalKgCo2e: number;
  readonly perPassengerKgCo2e: number;
  /** What each passenger would have emitted riding alone. */
  readonly soloKgCo2e: number;
  readonly savedKgCo2e: number;
  readonly savedPercent: number;
}

export function tripEmissions(
  fuelType: FuelType,
  distanceKm: number,
  passengers: number,
  kmPerUnitOverride?: number,
): TripEmissions {
  if (passengers <= 0) throw new RangeError('A trip needs at least one passenger');

  const factors = factorsFor(fuelType);
  const kmPerUnit = kmPerUnitOverride ?? factors.kmPerUnit;
  const totalKgCo2e = (distanceKm / kmPerUnit) * factors.kgCo2ePerUnit;

  const perPassengerKgCo2e = totalKgCo2e / passengers;
  const soloKgCo2e = totalKgCo2e;
  const savedKgCo2e = soloKgCo2e - perPassengerKgCo2e;

  return {
    totalKgCo2e,
    perPassengerKgCo2e,
    soloKgCo2e,
    savedKgCo2e,
    savedPercent: soloKgCo2e === 0 ? 0 : (savedKgCo2e / soloKgCo2e) * 100,
  };
}

/**
 * Phrase a passenger's cumulative saving in something they can picture. Grams of
 * CO2 mean nothing to anybody; "a tree's worth of work" lands.
 */
export function describeSaving(cumulativeKgCo2e: number): string {
  if (cumulativeKgCo2e < 1) {
    return `${Math.round(cumulativeKgCo2e * 1000)} g of CO₂ saved by sharing`;
  }
  if (cumulativeKgCo2e < 21) {
    return `${cumulativeKgCo2e.toFixed(1)} kg of CO₂ saved by sharing`;
  }
  // A mature tree absorbs roughly 21 kg CO2/year.
  const treeYears = cumulativeKgCo2e / 21;
  return `${cumulativeKgCo2e.toFixed(0)} kg of CO₂ saved — about ${treeYears.toFixed(1)} ${
    treeYears < 2 ? 'tree-year' : 'tree-years'
  } of work`;
}
