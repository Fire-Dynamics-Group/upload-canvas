import { useState, useEffect } from 'react'
import { listProjects, renameProject } from './ApiCalls'
import FDRobot from './FDRobot'
import useStore from '../store/useStore'

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const seconds = Math.floor((now - date) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

export default function ProjectDashboard({ onSelectProject, onNewProject, userName, onEditName, onModeSwitch }) {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all') // 'mine' | 'all'
  const [showNewModal, setShowNewModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [renameTarget, setRenameTarget] = useState(null) // project being renamed
  const [renameValue, setRenameValue] = useState('')
  const [renameError, setRenameError] = useState(null)
  const [renameSaving, setRenameSaving] = useState(false)

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listProjects()
      setProjects(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const filtered = (filter === 'mine'
    ? projects.filter(p => p.created_by === userName)
    : projects
  ).slice().sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
    return bTime - aTime
  })

  const handleCreate = () => {
    const name = newName.trim() || 'Untitled Project'
    setShowNewModal(false)
    setNewName('')
    onNewProject(name)
  }

  const openRename = (e, project) => {
    e.stopPropagation()
    setRenameTarget(project)
    setRenameValue(project.name || '')
    setRenameError(null)
  }

  const closeRename = () => {
    setRenameTarget(null)
    setRenameValue('')
    setRenameError(null)
    setRenameSaving(false)
  }

  const handleRename = async () => {
    if (!renameTarget) return
    const name = renameValue.trim()
    if (!name) {
      setRenameError('Name cannot be empty')
      return
    }
    if (name === renameTarget.name) {
      closeRename()
      return
    }
    setRenameSaving(true)
    setRenameError(null)
    try {
      const updated = await renameProject(renameTarget.id, name)
      setProjects((prev) =>
        prev.map((p) => (p.id === renameTarget.id ? { ...p, name: updated.name } : p))
      )
      closeRename()
    } catch (err) {
      setRenameError(err.message)
      setRenameSaving(false)
    }
  }

  const currentMode = useStore((state) => state.currentMode)
  const setCurrentMode = useStore((state) => state.setCurrentMode)

  const modeOptions = [
    { key: 'fdsGen', label: 'FDS Generation' },
    { key: 'radiation', label: 'Radiation' },
    { key: 'timeEq', label: 'Time Equivalence' },
    { key: 'efs', label: 'External Fire Spread' },
  ]

  const handleModeClick = (mode) => {
    setCurrentMode(mode)
    if (mode !== 'fdsGen' && onModeSwitch) {
      onModeSwitch(mode)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Mode switcher */}
      <div className="flex items-center gap-2 px-6 pt-4 pb-2">
        <span className="text-sm text-gray-400 mr-2">Mode:</span>
        {modeOptions.map((m) => (
          <button
            key={m.key}
            onClick={() => handleModeClick(m.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              currentMode === m.key
                ? 'bg-blue-700 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 border border-gray-700'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <FDRobot hintText={`Hi, ${userName}`} />
          <button
            onClick={onEditName}
            className="text-gray-400 hover:text-white text-sm ml-2"
            title="Change name"
          >
            ✏️
          </button>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5"
        >
          + New Project
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-6 pt-4">
        <button
          onClick={() => setFilter('mine')}
          className={`px-4 py-2 rounded-t-lg text-sm font-medium ${
            filter === 'mine'
              ? 'bg-gray-700 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          My Projects
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-t-lg text-sm font-medium ${
            filter === 'all'
              ? 'bg-gray-700 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          All Projects
        </button>
      </div>

      {/* Content */}
      <div className="px-6 py-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-red-400 mb-4">Failed to load projects: {error}</p>
            <button onClick={loadProjects} className="text-blue-400 hover:text-blue-300 underline">
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg mb-2">
              {filter === 'mine' ? 'You have no projects yet' : 'No projects found'}
            </p>
            <button
              onClick={() => setShowNewModal(true)}
              className="text-blue-400 hover:text-blue-300 underline"
            >
              Create your first project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((project) => (
              <div
                key={project.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectProject(project.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelectProject(project.id)
                  }
                }}
                className="relative bg-gray-800 hover:bg-gray-700 rounded-lg overflow-hidden text-left transition-colors border border-gray-700 hover:border-gray-500 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {project.settings?.thumbnail ? (
                  <img
                    src={project.settings.thumbnail}
                    alt={project.name}
                    className="w-full h-40 object-cover bg-gray-900"
                  />
                ) : (
                  <div className="w-full h-40 bg-gray-900 flex items-center justify-center text-gray-600 text-sm">
                    No preview
                  </div>
                )}
                <button
                  type="button"
                  onClick={(e) => openRename(e, project)}
                  title="Rename project"
                  aria-label="Rename project"
                  className="absolute top-2 right-2 p-1.5 rounded-md bg-gray-900 bg-opacity-70 hover:bg-opacity-100 text-gray-300 hover:text-white"
                >
                  ✏️
                </button>
                <div className="p-4">
                  <h3 className="font-medium text-white truncate">{project.name}</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    {project.created_by || 'Unknown'}
                  </p>
                  <div className="flex justify-between items-center mt-3 text-xs text-gray-500">
                    <span>{project.floors?.length || 0} floor{(project.floors?.length || 0) !== 1 ? 's' : ''}</span>
                    <span>{timeAgo(project.updated_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rename Project Modal */}
      {renameTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-medium mb-4">Rename Project</h2>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Project name"
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              disabled={renameSaving}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename()
                if (e.key === 'Escape') closeRename()
              }}
            />
            {renameError && (
              <p className="text-sm text-red-400 mb-2">{renameError}</p>
            )}
            <div className="flex justify-end gap-3 mt-2">
              <button
                onClick={closeRename}
                disabled={renameSaving}
                className="px-4 py-2 text-gray-400 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRename}
                disabled={renameSaving}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg disabled:opacity-50"
              >
                {renameSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Project Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-medium mb-4">New Project</h2>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Project name"
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowNewModal(false); setNewName('') }}
                className="px-4 py-2 text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
