import { useState, useEffect, useRef } from 'react'
import {
    saveProjectToServer,
    downloadStructuralFireReport,
    getFeeEngineers,
    getFeeGenerationsForProject,
    getPreviousFeeOptions,
} from '../ApiCalls'
import { authedFetch } from '../../lib/auth/token'

const DEFAULT_DETAILS = {
    synergyProjectRef: '',
    jobNumber: '',
    projectName: '',
    client: '',
    location: '',
    reportTitle: 'Fire Resistance of the Office Floor Slab Structure',
    date: '',
    author: '',
    checkedBy: '',
    verifiedBy: '',
    targetReliability: '98.2',
    buildingDescription: '',
    sitePlanImage: '',
    markupImage: '',
}

function detailsFromProject(project, userName = '') {
    const saved = project?.settings?.reportDetails || {}
    return {
        synergyProjectRef: saved.synergyProjectRef || '',
        jobNumber: saved.jobNumber || '',
        projectName: saved.projectName || project?.name || '',
        client: saved.client || '',
        location: saved.location || '',
        reportTitle: saved.reportTitle || DEFAULT_DETAILS.reportTitle,
        date: saved.date || '',
        author: saved.author || userName || '',
        checkedBy: saved.checkedBy || '',
        verifiedBy: saved.verifiedBy || '',
        targetReliability:
            saved.targetReliability !== undefined && saved.targetReliability !== null
                ? String(saved.targetReliability)
                : DEFAULT_DETAILS.targetReliability,
        buildingDescription: saved.buildingDescription || '',
        sitePlanImage: saved.sitePlanImage || '',
        markupImage: saved.markupImage || '',
    }
}

function buildBuildingContextFromFee(feeGen, fallbackName, fallbackLocation) {
    if (!feeGen || typeof feeGen !== 'object') return ''
    const inputs = feeGen.inputs || {}
    const proj = inputs.project || {}
    const name = proj.project_name || feeGen.project_name || fallbackName || ''
    const loc = proj.project_location || fallbackLocation || ''

    const stageLabels = {
        stage_1: 'RIBA Stage 1',
        stage_2: 'RIBA Stage 2',
        stage_3: 'RIBA Stage 3',
        stage_4: 'RIBA Stage 4',
        london_plan: 'London Plan',
        gateway: 'Gateway',
        tma_structural: 'Tensile Membrane Action (MACS+)',
        common_corridor_cfd: 'Common Corridor CFD',
        open_plan_cfd: 'Open Plan CFD',
    }
    const stagesObj = inputs.design_stages || {}
    const includedStages = Object.entries(stageLabels)
        .filter(([k]) => stagesObj[k]?.included)
        .map(([, label]) => label)

    const customDesc =
        (typeof inputs.building_description === 'string' && inputs.building_description.trim()) ||
        (typeof inputs.text_overrides?.building_description === 'string' &&
            inputs.text_overrides.building_description.trim()) ||
        ''

    if (customDesc) return customDesc

    const parts = []
    if (name) {
        parts.push(
            `Structural fire engineering assessment for ${name}${loc ? ` located at ${loc}` : ''}.`
        )
    }
    if (includedStages.length > 0) {
        parts.push(`Fee scope includes: ${includedStages.join(', ')}.`)
    }
    return parts.join(' ')
}

function formatSiteAddress(siteAddress) {
    if (!siteAddress) return ''
    return [
        ...(Array.isArray(siteAddress.lines) ? siteAddress.lines : []),
        siteAddress.town,
        siteAddress.state,
        siteAddress.postcode,
    ]
        .filter(Boolean)
        .join(', ')
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = () => reject(new Error('Failed to read image file'))
        reader.readAsDataURL(file)
    })
}

function formatOptionMeta(opt) {
    if (!opt) return null
    const parts = []
    if (opt.by) parts.push(String(opt.by).split(' ')[0])
    if (opt.count > 1) {
        parts.push(`${opt.count}×`)
    } else if (opt.latest_at) {
        const d = new Date(opt.latest_at)
        if (!Number.isNaN(d.getTime())) {
            parts.push(d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }))
        }
    }
    return parts.length ? parts.join(' · ') : null
}

function dedupeOptions(list) {
    const seen = new Set()
    const out = []
    for (const item of list) {
        const val = String(item?.value || '').trim()
        if (!val) continue
        const key = val.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        out.push({
            value: val,
            source: item.source || 'synergy',
            meta: item.meta || null,
        })
    }
    return out
}

const SOURCE_LABELS = {
    synergy: 'From Total Synergy',
    previous_fee: 'From previous fee',
    microsoft: 'From Microsoft sign-in',
}

const SOURCE_WAS = {
    synergy: 'was from Total Synergy',
    previous_fee: 'was from a previous fee',
    microsoft: 'was from Microsoft sign-in',
}

function SourceBadge({ provenance }) {
    if (!provenance) return null
    if (provenance.kind === 'edited') {
        const wasText = SOURCE_WAS[provenance.was] || ''
        return (
            <span
                title={wasText}
                className="shrink-0 rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[10px] leading-none text-gray-600 font-normal"
            >
                Edited by you
            </span>
        )
    }
    const label = SOURCE_LABELS[provenance.kind]
    if (!label) return null
    const tone =
        provenance.kind === 'previous_fee'
            ? 'border-indigo-200 bg-indigo-50 text-indigo-800'
            : 'border-sky-200 bg-sky-50 text-sky-800'
    return (
        <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] leading-none font-normal ${tone}`}>
            {label}
        </span>
    )
}

function OptionChips({ label, options, currentValue, onSelect }) {
    if (!options || options.length === 0) return null
    return (
        <div className="mt-1.5">
            {label && <p className="mb-1 text-[11px] font-medium text-gray-600">{label} options</p>}
            <div className="flex flex-wrap gap-1.5">
                {options.map((opt) => {
                    const selected = (currentValue || '').trim().toLowerCase() === opt.value.toLowerCase()
                    const tag =
                        opt.source === 'synergy'
                            ? 'Synergy'
                            : opt.meta
                              ? `Prev fee · ${opt.meta}`
                              : 'Prev fee'
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => onSelect(opt)}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] focus:outline-none focus:ring-2 focus:ring-gray-400 ${
                                selected
                                    ? 'border-gray-900 bg-gray-900 text-white'
                                    : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'
                            }`}
                        >
                            <span>{opt.value}</span>
                            <span
                                className={`rounded px-1 py-0.5 text-[10px] leading-none ${
                                    selected
                                        ? 'bg-gray-700 text-gray-100'
                                        : opt.source === 'synergy'
                                          ? 'bg-sky-50 text-sky-800'
                                          : 'bg-indigo-50 text-indigo-800'
                                }`}
                            >
                                {tag}
                            </span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

export default function ReportBuilderTab({ project, effectiveBatch, userName = '', onProjectUpdated }) {
    const [form, setForm] = useState(() => detailsFromProject(project, userName))
    const [engineers, setEngineers] = useState([])
    const [fieldOptions, setFieldOptions] = useState({ projectName: [], client: [], location: [] })
    const [feeBuildingContext, setFeeBuildingContext] = useState('')
    const [provenance, setProvenance] = useState(() => ({
        ...(project?.settings?.reportDetails?.provenance || {}),
        ...(!project?.settings?.reportDetails?.author && userName
            ? { author: { kind: 'microsoft' } }
            : {}),
    }))
    const [isSaving, setIsSaving] = useState(false)
    const [isDownloading, setIsDownloading] = useState(false)
    const [notice, setNotice] = useState(null)
    const [error, setError] = useState(null)

    // Synergy Project Directory search state
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState([])
    const [isSearching, setIsSearching] = useState(false)
    const [searchOpen, setSearchOpen] = useState(false)
    const [isPrefilling, setIsPrefilling] = useState(false)
    const searchTimeoutRef = useRef(null)

    useEffect(() => {
        setForm(detailsFromProject(project, userName))
        setNotice(null)
        setError(null)
    }, [project?.id, userName])

    useEffect(() => {
        let cancelled = false
        getFeeEngineers()
            .then((list) => {
                if (!cancelled && Array.isArray(list)) setEngineers(list)
            })
            .catch(() => {})
        return () => {
            cancelled = true
        }
    }, [])

    useEffect(() => {
        const q = searchQuery.trim()
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
        if (q.length < 2) {
            setSearchResults([])
            setIsSearching(false)
            return
        }
        setIsSearching(true)
        searchTimeoutRef.current = setTimeout(async () => {
            try {
                const resp = await authedFetch(
                    `/api/directory/projects?q=${encodeURIComponent(q)}&limit=12`
                )
                if (resp.ok) {
                    const data = await resp.json()
                    setSearchResults(Array.isArray(data?.items) ? data.items : [])
                    setSearchOpen(true)
                } else {
                    setSearchResults([])
                }
            } catch (_) {
                setSearchResults([])
            } finally {
                setIsSearching(false)
            }
        }, 250)
        return () => {
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
        }
    }, [searchQuery])

    const handleSelectDirectoryProject = async (item) => {
        setSearchOpen(false)
        setSearchQuery(item.label || `${item.number || ''} ${item.name || ''}`.trim())
        setIsPrefilling(true)
        setError(null)
        try {
            const [prefillResp, feeGens, prevOpts] = await Promise.all([
                authedFetch(`/api/directory/prefill?ref=${encodeURIComponent(item.id)}`),
                getFeeGenerationsForProject(item.id, 5).catch(() => []),
                getPreviousFeeOptions(item.id).catch(() => null),
            ])
            const prefill = prefillResp.ok ? await prefillResp.json() : null
            const latestFeeGen = Array.isArray(feeGens) && feeGens.length > 0 ? feeGens[0] : null
            const feeInputs = latestFeeGen?.inputs || {}
            const prev = prevOpts?.options || {}

            const synergyName = prefill?.fields?.projectName?.value || item.name || ''
            const synergyLocation = formatSiteAddress(prefill?.siteAddress)
            const synergyClient =
                prefill?.client?.displayName || prefill?.fields?.clientCompany?.value || ''

            const nameOptions = dedupeOptions([
                ...(synergyName ? [{ value: synergyName, source: 'synergy' }] : []),
                ...(Array.isArray(prev.projectName)
                    ? prev.projectName.map((o) => ({
                          value: o.value,
                          source: 'previous_fee',
                          meta: formatOptionMeta(o),
                      }))
                    : []),
            ])
            const clientOptions = dedupeOptions([
                ...(synergyClient ? [{ value: synergyClient, source: 'synergy' }] : []),
                ...(Array.isArray(prefill?.client?.candidates)
                    ? prefill.client.candidates.map((c) => ({
                          value: c.displayName || c.name || '',
                          source: 'synergy',
                      }))
                    : []),
                ...(Array.isArray(prev.company)
                    ? prev.company.map((o) => ({
                          value: o.value,
                          source: 'previous_fee',
                          meta: formatOptionMeta(o),
                      }))
                    : []),
            ])
            const locationOptions = dedupeOptions([
                ...(synergyLocation ? [{ value: synergyLocation, source: 'synergy' }] : []),
                ...(Array.isArray(prev.projectLocation)
                    ? prev.projectLocation.map((o) => ({
                          value: o.value,
                          source: 'previous_fee',
                          meta: formatOptionMeta(o),
                      }))
                    : []),
            ])
            setFieldOptions({
                projectName: nameOptions,
                client: clientOptions,
                location: locationOptions,
            })

            const inferredJobNumber =
                item.numberFormatted ||
                item.projectNumber ||
                item.number ||
                (prefill?.project?.label ? prefill.project.label.split('—')[0].trim() : '')
            const chosenName =
                nameOptions[0] ||
                (feeInputs.project?.project_name
                    ? { value: feeInputs.project.project_name, source: 'previous_fee' }
                    : null)
            const chosenClient =
                clientOptions[0] ||
                (feeInputs.client?.company_name
                    ? { value: feeInputs.client.company_name, source: 'previous_fee' }
                    : null)
            const chosenLocation =
                locationOptions[0] ||
                (feeInputs.project?.project_location
                    ? { value: feeInputs.project.project_location, source: 'previous_fee' }
                    : null)
            const feeContext = buildBuildingContextFromFee(
                latestFeeGen,
                chosenName?.value || '',
                chosenLocation?.value || ''
            )

            setFeeBuildingContext(feeContext || '')

            setForm((prevForm) => ({
                ...prevForm,
                synergyProjectRef: item.id,
                jobNumber: inferredJobNumber || prevForm.jobNumber,
                projectName: chosenName?.value || prevForm.projectName,
                client: chosenClient?.value || prevForm.client,
                location: chosenLocation?.value || prevForm.location,
            }))
            setProvenance((prevProv) => ({
                ...prevProv,
                ...(chosenName ? { projectName: { kind: chosenName.source } } : {}),
                ...(chosenClient ? { client: { kind: chosenClient.source } } : {}),
                ...(chosenLocation ? { location: { kind: chosenLocation.source } } : {}),
            }))
        } catch (err) {
            setError(err.message || 'Failed to load project details from directory')
        } finally {
            setIsPrefilling(false)
        }
    }

    const update = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }))
        setProvenance((prev) => {
            const cur = prev[field]
            if (!cur || cur.kind === 'edited') return prev
            return { ...prev, [field]: { kind: 'edited', was: cur.kind } }
        })
    }

    const pickOption = (field, opt) => {
        setForm((prev) => ({ ...prev, [field]: opt.value }))
        setProvenance((prev) => ({
            ...prev,
            [field]: { kind: opt.source === 'previous_fee' ? 'previous_fee' : 'synergy' },
        }))
    }

    const handleImageUpload = async (field, e) => {
        const file = e.target.files?.[0]
        if (!file) return
        try {
            const dataUrl = await readFileAsDataUrl(file)
            update(field, dataUrl)
        } catch (err) {
            setError(err.message || 'Could not load image')
        }
    }

    const persistDetails = async () => {
        if (!project?.id) return null
        const parsedTarget = Number(form.targetReliability)
        const reportDetails = {
            synergyProjectRef: form.synergyProjectRef || undefined,
            jobNumber: form.jobNumber.trim(),
            projectName: form.projectName.trim(),
            client: form.client.trim(),
            location: form.location.trim(),
            reportTitle: form.reportTitle.trim() || DEFAULT_DETAILS.reportTitle,
            date: form.date.trim(),
            author: form.author.trim(),
            checkedBy: form.checkedBy.trim(),
            verifiedBy: form.verifiedBy.trim(),
            targetReliability: Number.isFinite(parsedTarget) ? parsedTarget : 98.2,
            buildingDescription: form.buildingDescription.trim(),
            sitePlanImage: form.sitePlanImage || undefined,
            markupImage: form.markupImage || undefined,
            provenance,
        }
        const nextSettings = {
            ...(project.settings || {}),
            reportDetails,
        }
        const updated = await saveProjectToServer(project.id, { settings: nextSettings })
        if (onProjectUpdated) onProjectUpdated(updated)
        return updated
    }

    const handleSaveOnly = async (e) => {
        e.preventDefault()
        if (!project?.id) return
        setIsSaving(true)
        setError(null)
        setNotice(null)
        try {
            await persistDetails()
            setNotice('Report inputs saved to project.')
        } catch (err) {
            setError(err.message || 'Failed to save report inputs')
        } finally {
            setIsSaving(false)
        }
    }

    const handleSaveAndDownload = async () => {
        if (!project?.id) return
        setIsDownloading(true)
        setError(null)
        setNotice(null)
        try {
            await persistDetails()
            await downloadStructuralFireReport(
                project.id,
                form.projectName.trim() || project.name || 'Project',
                form.jobNumber.trim()
            )
            setNotice('Collated report (.docx) downloaded.')
        } catch (err) {
            setError(err.message || 'Failed to generate report')
        } finally {
            setIsDownloading(false)
        }
    }

    // Readiness metrics (honest: no fake fallbacks)
    const macsCharts = effectiveBatch?.charts || {}
    const macsChartCount = ['scatter', 'totalCapacity', 'beamTemp', 'meshTemp'].filter((k) =>
        Boolean(macsCharts[k])
    ).length
    const macsRel =
        effectiveBatch?.reliability_percent !== undefined && effectiveBatch?.reliability_percent !== null
            ? `${Number(effectiveBatch.reliability_percent).toFixed(2)}%`
            : '—'

    const teqInputs = project?.settings?.timeEqInputs || {}
    const teqResult = project?.settings?.timeEqResult || null
    const teqCharts = teqResult?.charts || {}
    const teqChartCount = ['steelTempSpaghetti', 'passFailScatter'].filter((k) => Boolean(teqCharts[k])).length
    const teqRel =
        teqResult?.reliabilityPercent !== undefined && teqResult?.reliabilityPercent !== null
            ? `${Number(teqResult.reliabilityPercent).toFixed(2)}%`
            : teqResult?.failure_prob !== undefined && teqResult?.failure_prob !== null
              ? `${((1 - Number(teqResult.failure_prob)) * 100).toFixed(2)}%`
              : '—'

    return (
        <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2/3: Project-Specific Report Inputs */}
            <form
                onSubmit={handleSaveOnly}
                className="lg:col-span-2 bg-white rounded-lg border border-slate-200 shadow-xs p-5 space-y-5"
            >
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                    <div>
                        <h2 className="text-base font-bold text-slate-900">Report Inputs &amp; Project Metadata</h2>
                        <p className="text-xs text-slate-500">
                            Slotted into the Fire Dynamics Structural Fire Resistance (.docx) template.
                        </p>
                    </div>
                    <button
                        type="submit"
                        disabled={isSaving || isDownloading || !project?.id}
                        className="px-3.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 disabled:opacity-50"
                    >
                        {isSaving ? 'Saving…' : 'Save Inputs'}
                    </button>
                </div>

                {error && (
                    <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                        {error}
                    </div>
                )}
                {notice && (
                    <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
                        {notice}
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                    {/* Synergy Project / Job Number Search (same pattern as Fee Word Add-in) */}
                    <div className="sm:col-span-2 relative">
                        <label className="block">
                            <span className="font-semibold text-slate-700">
                                Search Project Name / Job Number (Synergy Directory)
                            </span>
                            <div className="mt-1 relative">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value)
                                        setSearchOpen(true)
                                    }}
                                    onFocus={() => {
                                        if (searchResults.length > 0) setSearchOpen(true)
                                    }}
                                    placeholder="Type job number (e.g. 0657) or project name to search…"
                                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                {(isSearching || isPrefilling) && (
                                    <span className="absolute right-2.5 top-1.5 text-[11px] text-blue-600">
                                        {isPrefilling ? 'Loading details…' : 'Searching…'}
                                    </span>
                                )}
                            </div>
                        </label>
                        {searchOpen && searchResults.length > 0 && (
                            <ul
                                role="listbox"
                                aria-label="Synergy project search results"
                                className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-md shadow-lg divide-y divide-slate-100"
                            >
                                {searchResults.map((item) => (
                                    <li key={item.id}>
                                        <button
                                            type="button"
                                            onClick={() => handleSelectDirectoryProject(item)}
                                            className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 flex items-center justify-between gap-2"
                                        >
                                            <span className="font-medium text-slate-800 truncate">
                                                {item.label || `${item.number || ''} — ${item.name || ''}`}
                                            </span>
                                            {item.status && (
                                                <span className="text-[10px] text-slate-400 shrink-0">
                                                    {typeof item.status === 'string' ? item.status : item.status?.name}
                                                </span>
                                            )}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <label className="block">
                        <span className="font-semibold text-slate-700">Job Number</span>
                        <input
                            type="text"
                            value={form.jobNumber}
                            onChange={(e) => update('jobNumber', e.target.value)}
                            placeholder="e.g. 0657"
                            className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </label>

                    <label className="block">
                        <span className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-slate-700">Project Name (Report)</span>
                            <SourceBadge provenance={provenance.projectName} />
                        </span>
                        <input
                            type="text"
                            value={form.projectName}
                            onChange={(e) => update('projectName', e.target.value)}
                            placeholder="e.g. Panattoni California Drive"
                            className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <OptionChips
                            label="Project Name"
                            options={fieldOptions.projectName}
                            currentValue={form.projectName}
                            onSelect={(opt) => pickOption('projectName', opt)}
                        />
                    </label>

                    <label className="block">
                        <span className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-slate-700">Client Name</span>
                            <SourceBadge provenance={provenance.client} />
                        </span>
                        <input
                            type="text"
                            value={form.client}
                            onChange={(e) => update('client', e.target.value)}
                            placeholder="e.g. Winvic Construction Ltd"
                            className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <OptionChips
                            label="Client Name"
                            options={fieldOptions.client}
                            currentValue={form.client}
                            onSelect={(opt) => pickOption('client', opt)}
                        />
                    </label>

                    <label className="block">
                        <span className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-slate-700">Site Location</span>
                            <SourceBadge provenance={provenance.location} />
                        </span>
                        <input
                            type="text"
                            value={form.location}
                            onChange={(e) => update('location', e.target.value)}
                            placeholder="e.g. Castleford, West Yorkshire"
                            className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <OptionChips
                            label="Site Location"
                            options={fieldOptions.location}
                            currentValue={form.location}
                            onSelect={(opt) => pickOption('location', opt)}
                        />
                    </label>

                    <label className="block sm:col-span-2">
                        <span className="font-semibold text-slate-700">Report Title</span>
                        <input
                            type="text"
                            value={form.reportTitle}
                            onChange={(e) => update('reportTitle', e.target.value)}
                            className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </label>

                    <label className="block">
                        <span className="font-semibold text-slate-700">Report Date</span>
                        <input
                            type="text"
                            value={form.date}
                            onChange={(e) => update('date', e.target.value)}
                            placeholder="DD-MM-YYYY (defaults to today)"
                            className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </label>

                    <label className="block">
                        <span className="font-semibold text-slate-700">Target Reliability (%)</span>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={form.targetReliability}
                            onChange={(e) => update('targetReliability', e.target.value)}
                            className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </label>

                    <label className="block">
                        <span className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-slate-700">Author</span>
                            <SourceBadge provenance={provenance.author} />
                        </span>
                        <select
                            value={form.author}
                            onChange={(e) => update('author', e.target.value)}
                            className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {!form.author && <option value="">Select author…</option>}
                            {Array.from(
                                new Set([
                                    ...(userName ? [userName] : []),
                                    ...(form.author ? [form.author] : []),
                                    ...engineers.map((eng) => eng.full_name || eng.name).filter(Boolean),
                                ])
                            ).map((name) => (
                                <option key={name} value={name}>
                                    {name}
                                </option>
                            ))}
                        </select>
                    </label>

                    <div className="block">
                        <span className="font-semibold text-slate-700">Checked By</span>
                        <div className="mt-1 w-full rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-500">
                            {form.checkedBy ? form.checkedBy : 'Populated after QA process'}
                        </div>
                    </div>

                    <label className="block sm:col-span-2">
                        <span className="font-semibold text-slate-700">Verified By</span>
                        <input
                            type="text"
                            value={form.verifiedBy}
                            onChange={(e) => update('verifiedBy', e.target.value)}
                            placeholder="Optional"
                            className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </label>

                    {feeBuildingContext && (
                        <div className="sm:col-span-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                            <span className="font-semibold text-slate-700">Fee context (reference only): </span>
                            {feeBuildingContext}
                        </div>
                    )}

                    <div className="block">
                        <span className="font-semibold text-slate-700">Site / Location Plan (Figure 1, optional)</span>
                        <input
                            type="file"
                            accept="image/png,image/jpeg"
                            onChange={(e) => handleImageUpload('sitePlanImage', e)}
                            className="mt-1 block w-full text-xs text-slate-600"
                        />
                        {form.sitePlanImage && (
                            <button
                                type="button"
                                onClick={() => update('sitePlanImage', '')}
                                className="mt-1 text-[11px] text-red-600 hover:underline"
                            >
                                Remove site plan
                            </button>
                        )}
                    </div>

                    <div className="block">
                        <span className="font-semibold text-slate-700">Indicative Mark-up (Appendix D, optional)</span>
                        <input
                            type="file"
                            accept="image/png,image/jpeg"
                            onChange={(e) => handleImageUpload('markupImage', e)}
                            className="mt-1 block w-full text-xs text-slate-600"
                        />
                        {form.markupImage && (
                            <button
                                type="button"
                                onClick={() => update('markupImage', '')}
                                className="mt-1 text-[11px] text-red-600 hover:underline"
                            >
                                Remove mark-up
                            </button>
                        )}
                    </div>
                </div>
            </form>

            {/* Right 1/3: Readiness & Create Report */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 flex flex-col justify-between space-y-5">
                <div className="space-y-4">
                    <div className="border-b border-slate-100 pb-3">
                        <h3 className="text-base font-bold text-slate-900">Create Collated Report</h3>
                        <p className="text-xs text-slate-500">
                            Live status of data &amp; charts included in the generated Word report.
                        </p>
                    </div>

                    {/* MACS+ Status */}
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-1.5 text-xs">
                        <div className="font-bold text-slate-800">1. MACS+ Composite Slab</div>
                        {effectiveBatch ? (
                            <>
                                <div className="flex justify-between text-slate-600">
                                    <span>Batch:</span>
                                    <span className="font-semibold text-slate-800 truncate max-w-[160px]">
                                        {effectiveBatch.name || 'Linked Batch'}
                                    </span>
                                </div>
                                <div className="flex justify-between text-slate-600">
                                    <span>Reliability:</span>
                                    <span className="font-semibold text-slate-900">{macsRel}</span>
                                </div>
                                <div className="flex justify-between text-slate-600">
                                    <span>Charts Ready:</span>
                                    <span className="font-semibold text-slate-900">{macsChartCount} / 4 charts</span>
                                </div>
                            </>
                        ) : (
                            <div className="text-slate-500 italic">No MACS+ batch linked</div>
                        )}
                    </div>

                    {/* Time Eq Status */}
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-1.5 text-xs">
                        <div className="font-bold text-slate-800">2. Monte Carlo Time Equivalence</div>
                        {teqResult ? (
                            <>
                                <div className="flex justify-between text-slate-600">
                                    <span>Section / Limit:</span>
                                    <span className="font-semibold text-slate-800">
                                        {teqInputs.section || 'Assessed'} ({teqInputs.criticalTemp ?? '—'}°C)
                                    </span>
                                </div>
                                <div className="flex justify-between text-slate-600">
                                    <span>Sprinklers:</span>
                                    <span className="font-semibold text-slate-800">
                                        {teqInputs.isSprinklered ? 'Yes' : 'No'}
                                    </span>
                                </div>
                                <div className="flex justify-between text-slate-600">
                                    <span>Reliability:</span>
                                    <span className="font-semibold text-slate-900">{teqRel}</span>
                                </div>
                                <div className="flex justify-between text-slate-600">
                                    <span>Charts Ready:</span>
                                    <span className="font-semibold text-slate-900">{teqChartCount} / 2 charts</span>
                                </div>
                            </>
                        ) : (
                            <div className="text-slate-500 italic">No Time Equivalence results saved</div>
                        )}
                    </div>
                </div>

                <button
                    type="button"
                    onClick={handleSaveAndDownload}
                    disabled={isDownloading || isSaving || !project?.id}
                    className="w-full py-2.5 px-4 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
                >
                    {isDownloading ? 'Generating Report (.docx)…' : 'Save & Download Report (.docx)'}
                </button>
            </div>
        </div>
    )
}
