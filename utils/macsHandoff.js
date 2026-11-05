/**
 * Utilities for MACs handoffs and run comparison in upload-canvas.
 */

export function applyMacsRunToInputs(run, currentInputs = {}) {
    if (!run) return currentInputs
    return {
        ...currentInputs,
        calcType: 'reliability',
        memberProtection: 'unprotected',
        criticalTemp: run.critical_temp !== undefined ? run.critical_temp : currentInputs.criticalTemp,
        sectionFactor: run.section_factor !== undefined ? run.section_factor : currentInputs.sectionFactor,
        section: run.section || currentInputs.section || '',
        exposure: run.exposure || currentInputs.exposure || '',
        governingSide: run.governing_side || currentInputs.governingSide || '',
        macsRunId: run.run_id || run.id || null,
    }
}

export function isRunMatchingInputs(run, inputs = {}) {
    if (!run || !inputs) return false
    const ctMatches = Number(run.critical_temp) === Number(inputs.criticalTemp)
    const sfMatches = Number(run.section_factor) === Number(inputs.sectionFactor)
    const secMatches = !run.section || !inputs.section || run.section === inputs.section
    const expMatches = !run.exposure || !inputs.exposure || run.exposure === inputs.exposure
    return ctMatches && sfMatches && secMatches && expMatches
}

export function hasNewerMacsRun(runs, inputs = {}) {
    if (!Array.isArray(runs) || runs.length === 0) return null
    const newest = runs[0]
    if (!isRunMatchingInputs(newest, inputs)) {
        return newest
    }
    return null
}
