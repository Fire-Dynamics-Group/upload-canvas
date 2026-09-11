import { saveAs } from 'file-saver'

// One row per Monte Carlo sample, full precision — the QA artifact an engineer
// spot-checks against a hand calc. Glazing breakage arrives as a 0-1 fraction
// and is written as a percentage to match how the reports talk about it.
export function reliabilitySamplesCsv(samples) {
  const header = 'index,fuel_load_MJm2,glazing_breakage_pct,opening_factor,peak_steel_temp_C,failed'
  const rows = samples.map((s) =>
    [s.index, s.fuelLoad, s.glazingBreakage * 100, s.openingFactor, s.peakSteelTemp, s.failed].join(',')
  )
  return [header, ...rows].join('\n') + '\n'
}

// Seed in the filename so a downloaded CSV always traces back to the exact
// run it tabulates (matching the chart PNG naming).
export function downloadReliabilityResultsCsv(samples, seed = null) {
  const suffix = seed == null ? '' : `-seed${seed}`
  saveAs(
    new Blob([reliabilitySamplesCsv(samples)], { type: 'text/csv;charset=utf-8' }),
    `reliability-results${suffix}.csv`,
  )
}
