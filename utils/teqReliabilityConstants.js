// Shared constants for Monte Carlo Time-Equivalence Reliability mode.
// These mirror the backend (teq_reliability.py / time_eq.py) so the UI can show the
// values an engineer is implicitly choosing, and let them override.

// Surface thermal-inertia (b) per material. Mirrors time_eq.py material_b_values
// (sqrt of the tabulated values from Quintiere, Fundamentals of Fire Phenomena Table 7.6).
export const MATERIAL_B_VALUES = {
  concrete: Math.sqrt(3033240),     // ~1741.6
  brick: Math.sqrt(2805000),        // ~1674.8
  plasterboard: Math.sqrt(177650),  // ~421.5
}

// Fire-load-density distributions per occupancy. Mirrors data/fire_load_density.csv.
// mean in MJ/m2; the reliability calc samples from these (occupancy is the source of truth).
export const OCCUPANCY_DISTRIBUTIONS = [
  { occupancy: 'Dwelling', type: 'Gumbel type 1', mean: 780, cov: 0.3 },
  { occupancy: 'Hospital', type: 'Gumbel type 1', mean: 230, cov: 0.3 },
  { occupancy: 'Hotel room', type: 'Gumbel type 1', mean: 310, cov: 0.3 },
  { occupancy: 'Library', type: 'Gumbel type 1', mean: 1500, cov: 0.3 },
  { occupancy: 'Office', type: 'Gumbel type 1', mean: 420, cov: 0.3 },
  { occupancy: 'School', type: 'Gumbel type 1', mean: 285, cov: 0.3 },
  { occupancy: 'Fast food outlet', type: 'Log-normal', mean: 526, cov: 0.61 },
  { occupancy: 'Clothing store', type: 'Log-normal', mean: 393, cov: 0.42 },
  { occupancy: 'Restaurant', type: 'Log-normal', mean: 298, cov: 0.64 },
  { occupancy: 'Kitchen', type: 'Log-normal', mean: 314, cov: 0.51 },
  { occupancy: 'Retail unit storage area', type: 'Log-normal', mean: 1196, cov: 1.01 },
  { occupancy: 'Manufacturing and storage of combustible goods (<150 kg/m2)', type: 'Log-normal', mean: 1180, cov: 0.73 },
  { occupancy: 'Manufacturing and storage of combustible goods (>150 kg/m2)', type: 'Log-normal', mean: 9920, cov: 0.86 },
]

// Fire growth rate -> t_lim (minimum fire duration) in minutes, per EC1 Annex A.
export const GROWTH_RATES = [
  { label: 'Slow', tLimMinutes: 25 },
  { label: 'Medium', tLimMinutes: 20 },
  { label: 'Fast', tLimMinutes: 15 },
]

// Engine defaults (mirror teq_reliability.SteelParams), surfaced + overridable.
export const RELIABILITY_DEFAULTS = {
  nSim: 2000,
  combustionFactor: 0.8,
  sprinklerFactor: 0.65,
  sectionFactor: 135,
  criticalTemp: 500,
  growthRate: 'Medium',
}

export const UNPROTECTED_CRITICAL_TEMP_HELP =
  'Enter the governing perimeter-beam critical temperature from a MACS+ run.'

export const UNPROTECTED_CRITICAL_TEMP_REQUIRED =
  'Unprotected mode requires a critical temperature from the MACS+ run.'

export function hasCriticalTemp(value) {
  if (value === '' || value == null) return false
  const n = Number(value)
  return Number.isFinite(n)
}

export function reliabilityResultLines(result) {
  if (!result) return []
  const lines = [
    `Reliability: ${result.reliabilityPercent}%`,
    `${result.nFailed} of ${result.nSim} simulations exceeded ${result.criticalTemp}°C`,
  ]
  if (!result.unprotected) {
    lines.push(`FR period ${result.frPeriod} min · Protection ${result.protectionThickness_mm} mm`)
  }
  lines.push(`b-value ${Math.round(result.bValue)} · Section factor ${result.sectionFactor}`)
  return lines
}

// Plan length (m) of each wall segment of the first obstruction. Uses finalPoints, which
// the canvas stores in metres — the same segments the popup renders as "Wall N".
export function wallLengths(convertedPoints = []) {
  const obstruction = (convertedPoints || []).find((el) => el.comments === 'obstruction')
  const pts = obstruction?.finalPoints || []
  const lengths = []
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x
    const dy = pts[i + 1].y - pts[i].y
    lengths.push(Math.hypot(dx, dy))
  }
  return lengths
}
