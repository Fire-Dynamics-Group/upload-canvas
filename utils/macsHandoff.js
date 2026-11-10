/**
 * Utilities for MACs handoffs and run comparison in upload-canvas.
 */

import { createProject, saveProjectToServer } from '../Components/ApiCalls'

const handoffCreateLocks = new Map()
const PREFILL_KEY = 'macsHandoffPrefill'
let pendingPrefill = null

export function clearHandoffCreateLocks() {
    handoffCreateLocks.clear()
    pendingPrefill = null
}

const blank = (value) => value === undefined || value === null || value === ''

export function owningProjectId(created) {
    if (!created || typeof created !== 'object') return null
    return created.claimed_project_id || created.claimed_by_project_id || created.id || null
}

export function rememberHandoffPrefill(projectId, timeEqInputs, macsBatch) {
    if (!projectId) return
    pendingPrefill = {
        projectId,
        timeEqInputs: timeEqInputs || {},
        macsBatch: macsBatch ?? null,
    }
    try {
        sessionStorage.setItem(PREFILL_KEY, JSON.stringify(pendingPrefill))
    } catch (_) {}
}

export function readHandoffPrefill(projectId) {
    if (pendingPrefill?.projectId === projectId) return pendingPrefill
    try {
        const parsed = JSON.parse(sessionStorage.getItem(PREFILL_KEY) || 'null')
        if (parsed?.projectId === projectId) {
            pendingPrefill = parsed
            return parsed
        }
    } catch (_) {}
    return null
}

const PREFILL_KEYS = ['criticalTemp', 'sectionFactor', 'section', 'exposure', 'governingSide', 'macsRunId', 'calcType', 'memberProtection']

export function mergeSavedWithHandoffPrefill(saved, prefillInputs) {
    const merged = { ...(saved && typeof saved === 'object' ? saved : {}) }
    if (!prefillInputs || typeof prefillInputs !== 'object') return merged
    for (const key of PREFILL_KEYS) {
        if (blank(merged[key]) && !blank(prefillInputs[key])) merged[key] = prefillInputs[key]
    }
    return merged
}

export function settingsForFloorlessOpen(project, prefill) {
    const settings = project?.settings || {}
    const savedInputs = settings.timeEqInputs && typeof settings.timeEqInputs === 'object' ? settings.timeEqInputs : {}
    const prefillForProject = prefill?.projectId === project?.id ? prefill : null
    return {
        timeEqInputs: mergeSavedWithHandoffPrefill(savedInputs, prefillForProject?.timeEqInputs),
        macsBatch: settings.macsBatch ?? prefillForProject?.macsBatch ?? null,
        timeEqResult: settings.timeEqResult ?? null,
    }
}

export function formatMacsPrefill(inputs) {
    if (!inputs) return null
    const bits = []
    if (inputs.section) bits.push(inputs.section)
    if (!blank(inputs.criticalTemp)) bits.push(`${inputs.criticalTemp}°C`)
    if (!blank(inputs.sectionFactor)) bits.push(`Ap/V ${inputs.sectionFactor}`)
    if (inputs.exposure) bits.push(inputs.exposure)
    return bits.length ? bits.join(' · ') : null
}

// One handoff id creates one project, even when React Strict Mode runs the
// effect twice. The URL must use the id that owns the run.
export function createHandoffProject({ name, createdBy, handoffId, run, batch = null }) {
    if (!handoffId) return Promise.reject(new Error('Missing handoff'))
    const existing = handoffCreateLocks.get(handoffId)
    if (existing) return existing
    const promise = (async () => {
        const applied = applyMacsRunToInputs(run, {})
        const macsBatch = batch || run?.outputs?.macs_batch || null
        let created
        let alreadyClaimed = false
        try {
            created = await createProject(name, createdBy, 'timeEq', handoffId, {
                timeEqInputs: applied,
                ...(macsBatch ? { macsBatch } : {}),
            })
        } catch (err) {
            if (err.status === 409 && err.claimedByProjectId) {
                created = { id: err.claimedByProjectId }
                alreadyClaimed = true
            } else {
                throw err
            }
        }
        const projectId = owningProjectId(created)
        if (!projectId) throw new Error('Handoff create did not return a project')
        rememberHandoffPrefill(projectId, applied, macsBatch)
        if (!alreadyClaimed) {
            try {
                await saveProjectToServer(projectId, {
                    name: name || created.name || 'Structural Fire Assessment',
                    settings: {
                        timeEqInputs: applied,
                        ...(macsBatch ? { macsBatch } : {}),
                    },
                    floors: [],
                })
            } catch (err) {
                console.error('Failed to store handoff member inputs', err)
            }
        }
        return { projectId, applied, batch: macsBatch, alreadyClaimed }
    })()
    handoffCreateLocks.set(handoffId, promise)
    return promise
}

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
    const secMatches = Boolean(run.section) && Boolean(inputs.section) && run.section === inputs.section
    const expMatches = Boolean(run.exposure) && Boolean(inputs.exposure) && run.exposure === inputs.exposure
    return ctMatches && sfMatches && secMatches && expMatches
}

export function sortMacsRunsNewestFirst(runs) {
    if (!Array.isArray(runs)) return []
    const time = (run) => {
        const parsed = Date.parse(run?.received_at || run?.client_timestamp || '')
        return Number.isFinite(parsed) ? parsed : 0
    }
    return [...runs].sort((a, b) => time(b) - time(a))
}

export function hasNewerMacsRun(runs, inputs = {}) {
    if (!Array.isArray(runs) || runs.length === 0) return null
    const newest = runs[0]
    if (!isRunMatchingInputs(newest, inputs)) {
        return newest
    }
    return null
}
