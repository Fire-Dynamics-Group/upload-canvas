import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import {
    listProjects,
    loadProject,
    loadFloorDetail,
    createProject,
    getAllMacsRuns,
    getMacsRuns,
    getMacsRunDetail,
    claimHandoff,
} from '../Components/ApiCalls'
import MacsRunsFeed from '../Components/StructuralFire/MacsRunsFeed'
import MacsRunDetail from '../Components/StructuralFire/MacsRunDetail'
import MacsBatchOverview from '../Components/StructuralFire/MacsBatchOverview'
import TimeEqWorkspace from '../Components/StructuralFire/TimeEqWorkspace'

export default function StructuralFirePage() {
    const router = useRouter()
    const { project: queryProjectId, run: queryRunId } = router.query

    // Projects list
    const [projects, setProjects] = useState([])
    const [selectedProject, setSelectedProject] = useState(null)
    const [selectedFloor, setSelectedFloor] = useState(null)
    const [isLoadingProject, setIsLoadingProject] = useState(false)

    // MACS Runs
    const [allRuns, setAllRuns] = useState([])
    const [selectedRun, setSelectedRun] = useState(null)
    const [activeTab, setActiveTab] = useState('timeEq') // 'timeEq' | 'macsRun' | 'split'
    const [isClaiming, setIsClaiming] = useState(false)
    const [error, setError] = useState(null)

    // Initial load: projects & all cloud MACS runs
    useEffect(() => {
        let active = true
        async function fetchInitialData() {
            try {
                const [projList, runsList] = await Promise.all([
                    listProjects('timeEq').catch(() => []),
                    getAllMacsRuns(50, 0).catch(() => []),
                ])
                if (!active) return
                setProjects(projList)
                setAllRuns(runsList)

                // If runId specified in URL, load it
                if (queryRunId) {
                    try {
                        const runDetail = await getMacsRunDetail(queryRunId)
                        if (active) setSelectedRun(runDetail)
                    } catch (_) {}
                } else if (runsList.length > 0) {
                    setSelectedRun(runsList[0])
                }
            } catch (err) {
                if (active) setError(err.message || 'Failed to load initial data')
            }
        }
        fetchInitialData()
        return () => { active = false }
    }, [queryRunId])

    // Load active project whenever queryProjectId or selectedProject changes
    const selectProjectById = useCallback(async (pid) => {
        if (!pid) {
            setSelectedProject(null)
            setSelectedFloor(null)
            return
        }
        setIsLoadingProject(true)
        setError(null)
        try {
            const p = await loadProject(pid)
            setSelectedProject(p)
            if (p.floors && p.floors.length > 0) {
                const f = await loadFloorDetail(pid, p.floors[0].id)
                setSelectedFloor(f)
            } else {
                setSelectedFloor(null)
            }

            // Also refresh runs associated with this project
            const projRuns = await getMacsRuns(pid).catch(() => [])
            if (projRuns.length > 0) {
                // Prepend or merge into allRuns
                setAllRuns((prev) => {
                    const ids = new Set(projRuns.map((r) => r.id))
                    return [...projRuns, ...prev.filter((r) => !ids.has(r.id))]
                })
                setSelectedRun(projRuns[0])
            }
        } catch (err) {
            setError(`Failed to load project: ${err.message}`)
        } finally {
            setIsLoadingProject(false)
        }
    }, [])

    useEffect(() => {
        if (queryProjectId && selectedProject?.id !== queryProjectId) {
            selectProjectById(queryProjectId)
        } else if (!queryProjectId && projects.length > 0 && !selectedProject) {
            selectProjectById(projects[0].id)
        }
    }, [queryProjectId, projects, selectProjectById, selectedProject?.id])

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

    // Handle claim handoff
    const handleClaimHandoff = async (handoffId) => {
        if (!selectedProject?.id) {
            throw new Error('Please select or create a project first to claim this handoff.')
        }
        setIsClaiming(true)
        try {
            const claimedRun = await claimHandoff(selectedProject.id, handoffId)
            const updatedRuns = await getMacsRuns(selectedProject.id)
            setAllRuns((prev) => [claimedRun, ...prev.filter((r) => r.id !== claimedRun.id)])
            setSelectedRun(claimedRun)
        } finally {
            setIsClaiming(false)
        }
    }

    const effectiveBatch = selectedProject?.settings?.macsBatch || selectedRun?.outputs?.macs_batch || null

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
            {/* Top Navigation Bar */}
            <header className="bg-slate-900 text-white px-6 py-3 shadow-md flex flex-wrap items-center justify-between gap-4 sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">🏗️</span>
                    <div>
                        <h1 className="text-lg font-bold tracking-tight leading-none">
                            Structural Fire Engineering
                        </h1>
                        <span className="text-[11px] text-slate-400">
                            MACS+ Composite Slab & Monte Carlo Time Equivalence
                        </span>
                    </div>
                </div>

                {/* Project Selector & Actions */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                        <span className="text-xs text-slate-400">Project:</span>
                        <select
                            value={selectedProject?.id || ''}
                            onChange={(e) => {
                                const id = e.target.value
                                if (id) {
                                    router.push(`/structural-fire?project=${id}`, undefined, { shallow: true })
                                    selectProjectById(id)
                                }
                            }}
                            className="bg-transparent text-xs font-semibold text-white outline-none cursor-pointer"
                        >
                            {projects.map((p) => (
                                <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                                    {p.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        type="button"
                        onClick={handleNewProject}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium px-2.5 py-1.5 rounded transition-colors"
                    >
                        + New
                    </button>

                    {selectedProject && (
                        <Link
                            href={`/?project=${selectedProject.id}&returnTo=structural-fire`}
                            className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-3 py-1.5 rounded shadow transition-colors flex items-center gap-1.5"
                        >
                            <span>🎨</span>
                            <span>Open on Canvas</span>
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
                    <button type="button" onClick={() => setError(null)} className="font-bold">×</button>
                </div>
            )}

            {/* Sub-header / View Tabs */}
            <div className="bg-white border-b border-gray-200 px-6 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
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
                        onClick={() => setActiveTab('macsBatch')}
                        className={`text-xs font-bold px-3 py-1.5 rounded transition-colors ${
                            activeTab === 'macsBatch'
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                        MACS 10,000-Sweep & Setup
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('macsRun')}
                        className={`text-xs font-bold px-3 py-1.5 rounded transition-colors ${
                            activeTab === 'macsRun'
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                        Single Run Curves & Detail
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
                    {selectedRun && (
                        <span>
                            Active MACS Run: <strong className="text-gray-800">{selectedRun.section || selectedRun.label}</strong> ({Math.round(selectedRun.critical_temp)}°C)
                        </span>
                    )}
                </div>
            </div>

            {/* Main Application Grid */}
            <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-[1700px] w-full mx-auto">
                {/* Left 3 Cols: Runs Feed */}
                <div className="lg:col-span-3">
                    <MacsRunsFeed
                        runs={allRuns}
                        batch={effectiveBatch}
                        selectedProjectId={selectedProject?.id}
                        projects={projects}
                        selectedRunId={selectedRun?.id || selectedRun?.run_id}
                        onSelectRun={(r) => setSelectedRun(r)}
                        onClaimHandoff={handleClaimHandoff}
                        isClaiming={isClaiming}
                        activeTimeEqInputs={selectedProject?.settings?.timeEqInputs}
                        onViewBatchOverview={() => setActiveTab('macsBatch')}
                    />
                </div>

                {/* Right 9 Cols: Main Workspace */}
                <div className="lg:col-span-9 space-y-6">
                    {isLoadingProject ? (
                        <div className="p-12 text-center text-sm text-gray-500 bg-white rounded-lg border border-gray-200">
                            Loading project data…
                        </div>
                    ) : (
                        <>
                            {activeTab === 'timeEq' && (
                                <TimeEqWorkspace
                                    project={selectedProject}
                                    floorDetail={selectedFloor}
                                    selectedMacsRun={selectedRun}
                                    onProjectUpdated={(p) => setSelectedProject(p)}
                                />
                            )}

                            {activeTab === 'macsBatch' && (
                                <MacsBatchOverview
                                    projectId={selectedProject?.id || projects[0]?.id}
                                    batch={effectiveBatch}
                                    runs={allRuns}
                                    selectedRun={selectedRun}
                                    onSelectRun={(r) => setSelectedRun(r)}
                                    onViewRunDetail={() => setActiveTab('macsRun')}
                                    onApplyToTimeEq={(r) => {
                                        setSelectedRun(r)
                                        setActiveTab('timeEq')
                                    }}
                                    onBack={() => setActiveTab('timeEq')}
                                />
                            )}

                            {activeTab === 'macsRun' && (
                                <MacsRunDetail
                                    run={selectedRun}
                                    batchSetup={effectiveBatch?.setup}
                                    onApplyToTimeEq={(r) => {
                                        setActiveTab('timeEq')
                                    }}
                                />
                            )}

                            {activeTab === 'split' && (
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                    <TimeEqWorkspace
                                        project={selectedProject}
                                        floorDetail={selectedFloor}
                                        selectedMacsRun={selectedRun}
                                        onProjectUpdated={(p) => setSelectedProject(p)}
                                    />
                                    <MacsRunDetail
                                        run={selectedRun}
                                        batchSetup={effectiveBatch?.setup}
                                        onApplyToTimeEq={(r) => {
                                            setActiveTab('timeEq')
                                        }}
                                    />
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
