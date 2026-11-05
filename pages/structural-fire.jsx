import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import {
    listProjects,
    loadProject,
    loadFloorDetail,
    createProject,
    getMacsRuns,
    getHandoff,
    claimHandoff,
} from '../Components/ApiCalls'
import MacsBatchOverview from '../Components/StructuralFire/MacsBatchOverview'
import TimeEqWorkspace from '../Components/StructuralFire/TimeEqWorkspace'
import { getStructuralCardMetrics } from '../Components/StructuralProjectCard'

export default function StructuralFirePage() {
    const router = useRouter()
    const { project: queryProjectId, run: queryRunId, handoff: queryHandoffId } = router.query

    // Projects list
    const [projects, setProjects] = useState([])
    const [selectedProject, setSelectedProject] = useState(null)
    const [selectedFloor, setSelectedFloor] = useState(null)
    const [isLoadingProject, setIsLoadingProject] = useState(false)

    // MACS Batch & Governing Run
    const [selectedRun, setSelectedRun] = useState(null)
    const [activeTab, setActiveTab] = useState('macsBatch') // 'macsBatch' | 'timeEq' | 'split'
    const [isClaiming, setIsClaiming] = useState(false)
    const [error, setError] = useState(null)

    // Project Switcher Dropdown state
    const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false)
    const [projectSearch, setProjectSearch] = useState('')
    const projectDropdownRef = useRef(null)

    useEffect(() => {
        function handleClickOutside(event) {
            if (projectDropdownRef.current && !projectDropdownRef.current.contains(event.target)) {
                setIsProjectDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Initial load: projects only (raw 10k run data stays on desktop results.db)
    useEffect(() => {
        let active = true
        async function fetchInitialData() {
            try {
                const projList = await listProjects('timeEq').catch(() => [])
                if (!active) return
                setProjects(projList)
            } catch (err) {
                if (active) setError(err.message || 'Failed to load projects')
            }
        }
        fetchInitialData()
        return () => { active = false }
    }, [])

    // Load active project whenever queryProjectId or selectedProject changes
    const selectProjectById = useCallback(async (pid) => {
        if (!pid) {
            setSelectedProject(null)
            setSelectedFloor(null)
            return
        }
        setIsLoadingProject(true)
        setError(null)
        setSelectedRun(null)
        try {
            const p = await loadProject(pid)
            setSelectedProject(p)
            if (p.floors && p.floors.length > 0) {
                const f = await loadFloorDetail(pid, p.floors[0].id)
                setSelectedFloor(f)
            } else {
                setSelectedFloor(null)
            }

            // Load governing run if present for critical temp handoff
            const projRuns = await getMacsRuns(pid).catch(() => [])
            setSelectedRun(projRuns && projRuns.length > 0 ? projRuns[0] : null)
        } catch (err) {
            setError(`Failed to load project: ${err.message}`)
        } finally {
            setIsLoadingProject(false)
        }
    }, [])

    useEffect(() => {
        if (queryProjectId && selectedProject?.id !== queryProjectId) {
            selectProjectById(queryProjectId)
        } else if (!queryProjectId && projects.length > 0 && !selectedProject && !queryHandoffId) {
            selectProjectById(projects[0].id)
        }
    }, [queryProjectId, projects, selectProjectById, selectedProject?.id, queryHandoffId])

    // Consume direct MACS handoff from query (?handoff=<id>)
    const hasProcessedHandoff = useRef(false)
    useEffect(() => {
        const handoffParam = queryHandoffId || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('handoff') : null)
        if (!handoffParam || hasProcessedHandoff.current) return
        hasProcessedHandoff.current = true

        async function processHandoff() {
            try {
                const handoff = await getHandoff(handoffParam)
                if (handoff?.run) {
                    const run = handoff.run
                    const defaultName = run.label || (run.section ? `Structural Fire - ${run.section}` : 'Structural Fire Assessment')
                    const created = await createProject(defaultName, null, 'timeEq', handoffParam)
                    setProjects((prev) => [created, ...prev])
                    router.replace(`/structural-fire?project=${created.id}`, undefined, { shallow: true })
                    selectProjectById(created.id)
                }
            } catch (err) {
                if (err.status === 409 && err.claimedByProjectId) {
                    router.replace(`/structural-fire?project=${err.claimedByProjectId}`, undefined, { shallow: true })
                    selectProjectById(err.claimedByProjectId)
                } else {
                    setError(`Failed to process MACS handoff: ${err.message}`)
                }
            }
        }
        processHandoff()
    }, [queryHandoffId, selectProjectById, router])

    // Handle project creation
    const handleNewProject = async () => {
        const name = window.prompt('Enter new project name:', 'Structural Fire Assessment')
        if (!name?.trim()) return
        try {
            const created = await createProject(name.trim(), null, 'timeEq')
            setProjects((prev) => [created, ...prev])
            router.push(`/structural-fire?project=${created.id}`, undefined, { shallow: true })
            selectProjectById(created.id)
        } catch (err) {
            alert(`Failed to create project: ${err.message}`)
        }
    }

    const effectiveBatch = selectedProject?.settings?.macsBatch || selectedRun?.outputs?.macs_batch || null
    const selectedMetrics = selectedProject ? getStructuralCardMetrics(selectedProject) : null

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
            {/* Top Navigation Bar */}
            <header className="bg-slate-900 text-white px-6 py-3 shadow-md flex flex-wrap items-center justify-between gap-4 sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">🔥🏢</span>
                    <div>
                        <h1 className="text-lg font-bold tracking-tight leading-none text-white">
                            Structural Fire Assessment
                        </h1>
                        <span className="text-[11px] text-slate-400">
                            MACS+ Composite Slab & Monte Carlo Time Equivalence
                        </span>
                    </div>
                </div>

                {/* Project Selector & Actions */}
                <div className="flex items-center gap-3">
                    {/* Back to Projects Hub */}
                    <Link
                        href="/?mode=timeEq"
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                        title="Return to Projects Hub"
                    >
                        <span>←</span>
                        <span>All Projects</span>
                    </Link>

                    {/* Rich Project Switcher Dropdown */}
                    <div className="relative" ref={projectDropdownRef}>
                        <button
                            type="button"
                            onClick={() => setIsProjectDropdownOpen((prev) => !prev)}
                            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-semibold text-white transition-colors cursor-pointer"
                        >
                            <span className="text-slate-400 text-[11px]">Assessment:</span>
                            <span className="max-w-[160px] truncate">{selectedProject?.name || 'Select Assessment'}</span>
                            {selectedProject && selectedMetrics && (
                                <span className={`w-2 h-2 rounded-full ${
                                    selectedMetrics.statusTone === 'emerald' ? 'bg-emerald-400' :
                                    selectedMetrics.statusTone === 'amber' ? 'bg-amber-400 animate-pulse' :
                                    selectedMetrics.statusTone === 'blue' ? 'bg-blue-400' : 'bg-slate-500'
                                }`} />
                            )}
                            <span className="text-[10px] text-slate-400 ml-0.5">▾</span>
                        </button>

                        {isProjectDropdownOpen && (
                            <div className="absolute right-0 mt-1.5 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-2 text-left animate-fadeIn">
                                <div className="px-1 py-1 border-b border-slate-800 mb-1.5">
                                    <input
                                        type="text"
                                        placeholder="Filter assessments..."
                                        value={projectSearch}
                                        onChange={(e) => setProjectSearch(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-full bg-slate-800 text-white text-xs px-2.5 py-1.5 rounded-md border border-slate-700 outline-none focus:border-indigo-500"
                                        autoFocus
                                    />
                                </div>

                                <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                                    {projects
                                        .filter((p) => p.name.toLowerCase().includes(projectSearch.toLowerCase()))
                                        .map((p) => {
                                            const m = getStructuralCardMetrics(p)
                                            const isSelected = p.id === selectedProject?.id
                                            return (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setIsProjectDropdownOpen(false)
                                                        router.push(`/structural-fire?project=${p.id}`, undefined, { shallow: true })
                                                        selectProjectById(p.id)
                                                    }}
                                                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors flex items-center justify-between gap-2 ${
                                                        isSelected
                                                            ? 'bg-indigo-950/80 text-white border border-indigo-700/60'
                                                            : 'text-slate-200 hover:bg-slate-800/80 border border-transparent'
                                                    }`}
                                                >
                                                    <div className="truncate flex-1">
                                                        <div className="font-semibold truncate">{p.name}</div>
                                                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                                            <span className={`w-1.5 h-1.5 rounded-full ${
                                                                m.statusTone === 'emerald' ? 'bg-emerald-400' :
                                                                m.statusTone === 'amber' ? 'bg-amber-400' :
                                                                m.statusTone === 'blue' ? 'bg-blue-400' : 'bg-slate-500'
                                                            }`} />
                                                            <span>{m.statusLabel}</span>
                                                        </div>
                                                    </div>
                                                    {isSelected && <span className="text-indigo-400 font-bold">✓</span>}
                                                </button>
                                            )
                                        })}
                                </div>

                                <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between px-1">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsProjectDropdownOpen(false)
                                            handleNewProject()
                                        }}
                                        className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 py-1"
                                    >
                                        <span>+ New Assessment</span>
                                    </button>
                                    <Link
                                        href="/?mode=timeEq"
                                        className="text-[11px] text-slate-400 hover:text-slate-200 py-1"
                                        onClick={() => setIsProjectDropdownOpen(false)}
                                    >
                                        ⊞ All Projects
                                    </Link>
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={handleNewProject}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                        + New
                    </button>

                    {selectedProject && (
                        <Link
                            href={`/?project=${selectedProject.id}&returnTo=structural-fire`}
                            className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow transition-colors flex items-center gap-1.5"
                        >
                            <span>📐</span>
                            <span>Compartment Plan Canvas</span>
                        </Link>
                    )}

                    <Link
                        href="/"
                        className="text-xs text-slate-400 hover:text-white transition-colors ml-2"
                    >
                        All Tools
                    </Link>
                </div>
            </header>

            {/* Error Banner */}
            {error && (
                <div className="bg-red-500 text-white text-xs px-4 py-2 font-medium flex items-center justify-between">
                    <span>{error}</span>
                    <button type="button" onClick={() => setError(null)} className="font-bold">✕</button>
                </div>
            )}

            {/* Sub-header / View Tabs */}
            <div className="bg-white border-b border-gray-200 px-6 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveTab('macsBatch')}
                        className={`text-xs font-bold px-3 py-1.5 rounded transition-colors ${
                            activeTab === 'macsBatch'
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                        MACS Batch & Report Charts
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('timeEq')}
                        className={`text-xs font-bold px-3 py-1.5 rounded transition-colors ${
                            activeTab === 'timeEq'
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                        Time Equivalence & Reliability
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('split')}
                        className={`text-xs font-bold px-3 py-1.5 rounded transition-colors ${
                            activeTab === 'split'
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                        Side-by-Side View
                    </button>
                </div>

                <div className="text-xs text-gray-500 flex items-center gap-2">
                    {effectiveBatch ? (
                        <span>
                            Linked MACS Batch: <strong className="text-gray-800">{effectiveBatch.name || 'Batch Overview'}</strong> ({Number(effectiveBatch.run_count || 0).toLocaleString()} runs)
                        </span>
                    ) : (
                        <span className="italic text-gray-400">No MACS batch linked to this project yet</span>
                    )}
                </div>
            </div>

            {/* Main Application Workspace (Full-width clean layout) */}
            <main className="flex-1 p-6 max-w-[1700px] w-full mx-auto">
                {isLoadingProject ? (
                    <div className="p-12 text-center text-sm text-gray-500 bg-white rounded-lg border border-gray-200">
                        Loading project data…
                    </div>
                ) : (
                    <>
                        {activeTab === 'macsBatch' && (
                            <MacsBatchOverview
                                projectId={selectedProject?.id || projects[0]?.id}
                                batch={effectiveBatch}
                                selectedRun={selectedRun}
                                onApplyToTimeEq={(r) => {
                                    setSelectedRun(r)
                                    setActiveTab('timeEq')
                                }}
                            />
                        )}

                        {activeTab === 'timeEq' && (
                            <TimeEqWorkspace
                                project={selectedProject}
                                floorDetail={selectedFloor}
                                selectedMacsRun={selectedRun}
                                onProjectUpdated={(p) => setSelectedProject(p)}
                            />
                        )}

                        {activeTab === 'split' && (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                                <div className="space-y-4">
                                    <div className="bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded flex items-center justify-between">
                                        <span>MACS+ Composite Slab & Batch Charts</span>
                                        <span className="text-[11px] text-slate-300 font-normal">
                                            {effectiveBatch ? `${Number(effectiveBatch.run_count || 0).toLocaleString()} runs` : 'Not linked'}
                                        </span>
                                    </div>
                                    <MacsBatchOverview
                                        projectId={selectedProject?.id || projects[0]?.id}
                                        batch={effectiveBatch}
                                        selectedRun={selectedRun}
                                        onApplyToTimeEq={(r) => {
                                            setSelectedRun(r)
                                        }}
                                    />
                                </div>
                                <div className="space-y-4">
                                    <div className="bg-blue-900 text-white text-xs font-bold px-3 py-1.5 rounded flex items-center justify-between">
                                        <span>Monte Carlo Time Equivalence</span>
                                        <span className="text-[11px] text-blue-200 font-normal">Reliability Analysis</span>
                                    </div>
                                    <TimeEqWorkspace
                                        project={selectedProject}
                                        floorDetail={selectedFloor}
                                        selectedMacsRun={selectedRun}
                                        onProjectUpdated={(p) => setSelectedProject(p)}
                                    />
                                </div>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    )
}
