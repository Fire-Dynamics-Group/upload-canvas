import Image from 'next/image';
import Canvas from '../Components/Canvas'
import { useEffect, useRef, useState, useCallback } from 'react'
import FDRobot from '../Components/FDRobot'
import useStore from '../store/useStore'
import ModePopup from '../Components/ModePopup'
import Toolbar from '../Components/Toolbar'
import ErrorPopup from '../Components/ErrorPopup'
import ViewTabs from '../Components/ViewTabs'
import ReliabilityResultsView from '../Components/ReliabilityResultsView'
import ThreeView from '../Components/ThreeView'
import FdsCodeView from '../Components/FdsCodeView'

import ProjectDashboard from '../Components/ProjectDashboard'
import useUserName from '../hooks/useUserName'
import { isDbBacked, autosaveSnapshot } from '../store/persistenceModes'
import { savePdfToIndexedDB, loadPdfFromIndexedDB } from '../utils/pdfStorage'
import { computeFramingScroll, elementPixelBox } from '../utils/viewportFraming'
import {
  createProject,
  saveProjectToServer,
  loadProject,
  loadFloorDetail,
  uploadFloorPdf,
  getFloorPdfUrl,
} from '../Components/ApiCalls'
import { wouldWipeElements } from '../utils/persistenceSafeguards'
import { describeSaveStatus } from '../utils/saveStatus'



// Check if we're in the browser environment
const isBrowser = typeof window !== "undefined";

// Only import pdfjs if we're in the browser
let pdfjs;
if (isBrowser) {
  pdfjs = require('pdfjs-dist/webpack');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.js';
}

// Error thrown by loadPdfDocument with a user-facing `message` already chosen.
class PdfLoadError extends Error {
  constructor(message, cause) {
    super(message)
    this.name = 'PdfLoadError'
    this.cause = cause
  }
}

// A 502/503/504 from the storage edge, or a "Failed to fetch" TypeError from a
// CORS/network failure, both mean the S3/MinIO bucket is unreachable right now
// (e.g. cold-starting or down). These are worth retrying.
const isTransientPdfError = (err) => {
  if (err?.status === 502 || err?.status === 503 || err?.status === 504) return true
  const msg = `${err?.message || ''} ${err?.details || ''}`
  return /failed to fetch|networkerror|load failed|network error/i.test(msg)
}

// Map a raw pdfjs/network error to a message a user can act on. A bucket outage
// surfaces in the browser as a CORS error, which is misleading — say what's
// actually wrong instead.
const friendlyPdfError = (err) => {
  if (isTransientPdfError(err)) {
    return 'The file storage service is temporarily unavailable. Please try again in a moment.'
  }
  if (err?.name === 'MissingPDFException' || err?.status === 404) {
    return 'The plan PDF could not be found in storage.'
  }
  return err?.message || 'Failed to load the plan PDF.'
}

// Load a PDF, retrying transient storage/network failures with a short backoff
// before giving up. On failure throws a PdfLoadError whose message is safe to
// show the user.
const loadPdfDocument = async (pdfjs, source, maxAttempts = 3) => {
  let lastErr
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await pdfjs.getDocument(source).promise
    } catch (err) {
      lastErr = err
      if (!isTransientPdfError(err) || attempt === maxAttempts) break
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000))
    }
  }
  throw new PdfLoadError(friendlyPdfError(lastErr), lastErr)
}

export default function Home() {
  let dev_mode = true
  const [hasMounted, setHasMounted] = useState(false)
  useEffect(() => { setHasMounted(true) }, [])
  const { userName, setUserName, needsName, clearName } = useUserName()
  const [nameInput, setNameInput] = useState('')
  const [uploading, setUploading] = useState(false)
  const [selectedImage, setSelectedImage] = useState("")
  const [selectedFile, setSelectedFile] = useState()
  const [isContinuing, setIsContinuing] = useState(false)
  const [isLoadingFromServer, setIsLoadingFromServer] = useState(false)
  const canvasDimensions = useStore((state) => state.canvasDimensions)
  const setCanvasDimensions = useStore((state) => state.setCanvasDimensions)
  const comment = useStore((state) => state.comment)
  const setComment = useStore((state) => state.setComment)

  const [showModePopup, setShowModePopup] = useState(false)
  const currentMode = useStore((state) => state.currentMode)
  const viewMode = useStore((state) => state.viewMode)
  const setPdfCanvasRef = useStore((state) => state.setPdfCanvasRef)
  const pdfCanvasRefLocal = useRef()
  useEffect(() => { setPdfCanvasRef(pdfCanvasRefLocal) }, [setPdfCanvasRef])

  const pdfCanvasRef = useStore((state) => state.pdfCanvasRef)

  const tool = useStore((state) => state.tool)
  const setTool = useStore((state) => state.setTool)

  const elements = useStore((state) => state.elements)
  const pixelsPerMesh = useStore((state) => state.pixelsPerMesh)
  // Highlighted element ids — set while configuring a specific element in the
  // docked inputs panel. Used to auto-frame that element beside the panel.
  const highlightedDoorId = useStore((state) => state.highlightedDoorId)
  const highlightedExtractId = useStore((state) => state.highlightedExtractId)
  const highlightedInletId = useStore((state) => state.highlightedInletId)
  const highlightedLandingId = useStore((state) => state.highlightedLandingId)
  const setPdfData = useStore((state) => state.setPdfData)
  const pdfData = useStore((state) => state.pdfData)
  const toggleIsPdfGreyscale = useStore((state) => state.toggleIsPdfGreyscale)
  const resetProject = useStore((state) => state.resetProject)

  // Project persistence state
  const projectId = useStore((state) => state.projectId)
  const floorId = useStore((state) => state.floorId)
  const projectName = useStore((state) => state.projectName)
  const saveStatus = useStore((state) => state.saveStatus)
  const setProjectId = useStore((state) => state.setProjectId)
  const setFloorId = useStore((state) => state.setFloorId)
  const setProjectName = useStore((state) => state.setProjectName)
  const setSaveStatus = useStore((state) => state.setSaveStatus)
  const buildSavePayload = useStore((state) => state.buildSavePayload)
  const hydrateFromServer = useStore((state) => state.hydrateFromServer)

  // --- Clear stale legacy localStorage (elements exist but no projectId) ---
  const hasCheckedLegacy = useRef(false)
  useEffect(() => {
    if (hasCheckedLegacy.current) return
    hasCheckedLegacy.current = true
    if (!projectId && elements.length > 0) {
      console.log('Clearing stale legacy localStorage (no projectId but elements exist)')
      resetProject()
    }
  }, [projectId, elements, resetProject])

  // Auto-load removed — users now pick projects from the dashboard

  // --- Debounced auto-save ---
  const saveTimerRef = useRef(null)
  const lastSavedRef = useRef(null)

  // Memoize the auto-save function
  const triggerAutoSave = useCallback(() => {
    // Only DB-backed modes with a project attached auto-save (see persistenceModes.js)
    if (!useStore.getState().shouldAutoSave()) return
    const currentProjectId = useStore.getState().projectId

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      const payload = useStore.getState().buildSavePayload()

      // Safeguard: the save endpoint is a delete-then-recreate of the floor, so
      // an empty-elements autosave deletes saved geometry. Skip a save that
      // would wipe a floor previously saved with elements (a transient in-memory
      // blank), comparing against the last successfully-saved payload.
      const previousSaved = lastSavedRef.current ? JSON.parse(lastSavedRef.current) : null
      if (wouldWipeElements(payload, previousSaved)) {
        console.warn('Skipping autosave: would wipe saved geometry with an empty floor')
        return
      }

      const payloadStr = JSON.stringify(payload)

      // Skip if nothing changed
      if (payloadStr === lastSavedRef.current) return

      useStore.getState().setSaveStatus("saving")
      try {
        await saveProjectToServer(currentProjectId, payload)
        lastSavedRef.current = payloadStr
        useStore.getState().setSaveStatus("saved")
        // Clear "saved" indicator after 2s
        setTimeout(() => useStore.getState().setSaveStatus(null), 2000)
      } catch (err) {
        console.error('Auto-save failed:', err)
        useStore.getState().setSaveStatus("error")
      }
    }, 2000)
  }, [])

  // Subscribe to state changes for auto-save (debounced)
  useEffect(() => {
    let prevSnapshot = null
    const unsub = useStore.subscribe((state) => {
      // Skip while no project is attached or the mode is scratch (radiation/efs)
      if (!state.shouldAutoSave()) return
      // The active mode's registry handler says which fields count as a change
      const fields = autosaveSnapshot(state)
      if (!fields) return
      const snapshot = JSON.stringify(fields)
      if (snapshot !== prevSnapshot) {
        prevSnapshot = snapshot
        triggerAutoSave()
      }
    })
    return () => unsub()
  }, [triggerAutoSave])

  // Auto-frame the element being configured. When a door/extract/inlet/landing
  // is highlighted from the docked inputs panel, scroll so it sits in the clear
  // area beside the panel instead of behind it. window.scrollTo today; this is
  // the seam the planned canvas pan/zoom will replace (see computeFramingScroll).
  useEffect(() => {
    const id = highlightedDoorId ?? highlightedExtractId ?? highlightedInletId ?? highlightedLandingId
    if (id == null || typeof window === 'undefined') return
    const box = elementPixelBox(elements.find((el) => el.id === id))
    if (!box) return
    const panelWidth = Math.min(384, window.innerWidth * 0.9) // SidePanel w-96 / max-w-90vw
    const { left, top } = computeFramingScroll(
      box,
      { width: window.innerWidth, height: window.innerHeight },
      { side: 'right', width: panelWidth },
    )
    window.scrollTo({ left, top, behavior: 'smooth' })
  }, [highlightedDoorId, highlightedExtractId, highlightedInletId, highlightedLandingId, elements])

  console.log("elements log: ", elements)

  // Shared function to render a PDF onto the canvas from any source
  const renderPdf = async (pdfSource, skipScale = false) => {
    if (!pdfCanvasRef.current) return
    const pdfjs = await import('pdfjs-dist/build/pdf')

    // pdfjs accepts a URL string or {data: ArrayBuffer}
    const source = typeof pdfSource === 'string' ? pdfSource : { data: pdfSource }
    const pdf = await loadPdfDocument(pdfjs, source)
    const page = await pdf.getPage(1)

    const canvas = pdfCanvasRef.current
    const context = canvas.getContext('2d')
    const scale = 1.5
    const viewport = page.getViewport({ scale })

    canvas.height = viewport.height
    canvas.width = viewport.width
    setCanvasDimensions({ width: canvas.width, height: canvas.height })

    await page.render({ canvasContext: context, viewport }).promise
    console.log('Page rendered')

    const colouredImageData = context.getImageData(0, 0, canvas.width, canvas.height)
    const greyScaledImageData = context.getImageData(0, 0, canvas.width, canvas.height)
    const data = greyScaledImageData.data
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3
      data[i] = avg
      data[i + 1] = avg
      data[i + 2] = avg
    }
    context.putImageData(greyScaledImageData, 0, 0)
    toggleIsPdfGreyscale(true)
    setSelectedFile(true)
    setShowUploadScreen(false)
    setPdfData({ coloured: colouredImageData, greyscaled: greyScaledImageData })

    if (skipScale) {
      setTool("selection")
      setComment("obstruction")
    }
  }

  const handleFileChange = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    const arrayBuffer = await file.arrayBuffer()

    // Render using a URL (pdfjs prefers this for File objects)
    await renderPdf(URL.createObjectURL(file), isContinuing)

    // Only persist/upload the PDF for DB-backed modes. Non-DB modes
    // (radiation/efs) are scratch — the plan must not survive a reload, so
    // it never reaches IndexedDB or S3. See persistenceModes.js.
    const mode = useStore.getState().currentMode
    if (isDbBacked(mode)) {
      // Cache raw PDF bytes in IndexedDB for later restore
      savePdfToIndexedDB(arrayBuffer)

      let currentProjectId = useStore.getState().projectId
      let currentFloorId = useStore.getState().floorId

      // If no project yet, create one + initial floor via bulk save
      if (!currentProjectId) {
        try {
          const name = useStore.getState().projectName || "Untitled Project"
          const project = await createProject(name, userName, mode)
          currentProjectId = project.id
          // Do an initial save to create floor 0
          const saved = await saveProjectToServer(currentProjectId, {
            name,
            settings: {},
            floors: [{ floor_number: 0, name: "Fire Floor", elements: [] }],
          })
          currentFloorId = saved.floors[0]?.id
          setProjectId(currentProjectId)
          setFloorId(currentFloorId)
          setProjectName(name)
        } catch (err) {
          console.error('Failed to create project:', err)
          // Surface it: without a projectId autosave never arms, so the user
          // would otherwise draw a whole plan that is never persisted (issue #3).
          setSaveStatus('create-failed')
          return
        }
      }

      // Upload to S3
      if (currentProjectId && currentFloorId) {
        try {
          const pdfFile = new File([arrayBuffer], 'plan.pdf', { type: 'application/pdf' })
          await uploadFloorPdf(currentProjectId, currentFloorId, pdfFile)
          console.log('PDF uploaded to S3')
        } catch (err) {
          console.error('Failed to upload PDF to S3:', err)
          setSaveStatus('pdf-failed')
        }
      }
    }
  }

  const handleButtonClick = (e) => {
    e.stopPropagation();
  };


  const menuOverlay = (<>

<div className="fixed bottom-0 left-0 right-0 bg-gray-800 text-white z-30 h-5vh" onClick={handleButtonClick}>
  <svg
    className="w-full h-1"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 1440 320"
    style={{ zIndex: -1 }}
  >
    <polygon
      points="0 0 1440 0 1440 120"
      className="fill-current bg-gray-900"
    />
    <polygon
      points="1440 0 0 0 0 120"
      className="fill-current bg-gray-800"
    />
  </svg>
  {/* Pin the toolbar as a true fixed overlay anchored to the viewport bottom,
      so it can't drift off-screen (the old `relative absolute` with no anchors
      did). It carries its own solid background so the tools always sit on a bar.
      flex-wrap lets it reflow rather than overflow on small/zoomed views. */}
  <div className="fixed bottom-0 left-0 right-0 flex flex-wrap justify-center items-center gap-1 py-2 z-[100] bg-gray-800 text-white">
    <Toolbar setShowModePopup={setShowModePopup}/>
  </div>
</div>

    </>
)


  const handleModeSelected = (mode) => {
    // Just navigate — the store has already detached the project (setCurrentMode).
    // DB-backed modes land on their own dashboard; scratch modes go to upload.
    setSelectedFile(undefined)
    setIsContinuing(false)
    setShowUploadScreen(!isDbBacked(mode))
  }

  const handleBackToDashboard = () => {
    // Go back to dashboard without destroying project data
    setSelectedFile(undefined)
    setIsContinuing(false)
    setShowUploadScreen(false)
  }

  const [showUploadScreen, setShowUploadScreen] = useState(false)

  const handleNewProject = (name) => {
    if (selectedFile) {
      if (!window.confirm('Start a new project? All current progress will be cleared.')) return
    }
    resetProject()
    setSelectedFile(undefined)
    setIsContinuing(false)
    setShowUploadScreen(true)
    if (name) setProjectName(name)
  }

  const handleSelectProject = async (projectId) => {
    setIsLoadingFromServer(true)
    try {
      const project = await loadProject(projectId)
      const floor = project.floors?.[0]
      if (!floor) throw new Error("No floors in project")

      const floorDetail = await loadFloorDetail(projectId, floor.id)
      hydrateFromServer(project, floorDetail)

      // Seed the last-saved baseline with what we just loaded, so the empty-save
      // guard knows the DB already holds geometry. Without this, an empty-elements
      // autosave fired before the first real save (previousSaved === null) could
      // wipe the loaded floor.
      lastSavedRef.current = JSON.stringify(useStore.getState().buildSavePayload())

      if (floor.pdf_s3_key) {
        const { url } = await getFloorPdfUrl(projectId, floor.id)
        await renderPdf(url, true)
      } else {
        // No PDF yet - go to upload screen
        setIsContinuing(true)
      }
    } catch (err) {
      console.error('Failed to load project:', err)
      // PdfLoadError.message is already user-facing; other errors get a prefix.
      alert(err instanceof PdfLoadError ? err.message : 'Failed to load project: ' + err.message)
    } finally {
      setIsLoadingFromServer(false)
    }
  }


  const showDashboard = isDbBacked(currentMode) && !selectedFile && !isContinuing && !isLoadingFromServer && !showUploadScreen

  if (!hasMounted) return null

  return (
    <>
      {/* Name prompt overlay */}
      {needsName && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100]">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm mx-4 text-white">
            <h2 className="text-lg font-medium mb-2">Welcome!</h2>
            <p className="text-sm text-gray-400 mb-4">Enter your name so your team knows who created each project.</p>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Your name"
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter' && nameInput.trim()) setUserName(nameInput.trim()) }}
            />
            <button
              onClick={() => { if (nameInput.trim()) setUserName(nameInput.trim()) }}
              disabled={!nameInput.trim()}
              className="w-full px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-600 text-white rounded-lg"
            >
              Continue
            </button>
          </div>
        </div>
      )}
      {/* Save status indicator */}
      {describeSaveStatus(saveStatus) && (
        <div className={`fixed top-2 left-1/2 -translate-x-1/2 z-50 text-xs px-3 py-1 rounded-full text-white ${
          describeSaveStatus(saveStatus).tone === "pending" ? "bg-yellow-600" :
          describeSaveStatus(saveStatus).tone === "success" ? "bg-green-600" :
          "bg-red-600"
        }`}>
          {describeSaveStatus(saveStatus).label}
        </div>
      )}
      {/* Top bar - visible when working on a project */}
      {selectedFile && (
        <div className="fixed top-2 right-2 z-50 flex gap-2">
          {isDbBacked(currentMode) && (
            <>
              <button
                onClick={handleBackToDashboard}
                className="text-white bg-gray-700 hover:bg-gray-600 font-medium rounded-lg text-sm px-4 py-2"
                type="button"
              >
                All Projects
              </button>
              <button
                onClick={() => handleNewProject()}
                className="text-white bg-red-700 hover:bg-red-800 focus:ring-4 focus:ring-red-300 font-medium rounded-lg text-sm px-4 py-2"
                type="button"
              >
                New Project
              </button>
            </>
          )}
        </div>
      )}
      {/* Toolbar belongs to the canvas — only show it when a plan is open, not
          on the dashboard / upload / loading screens (it's a fixed overlay now).
          Hidden in the 3D / FDS views, which are read-only. */}
      {selectedFile && tool != "scale" && viewMode === '2d' ? (<>
      {menuOverlay}
      </>
      )
      :null}
      {/* View switcher (2D / 3D / FDS) + the 3D / FDS overlays. The 2D Canvas
          stays mounted underneath so its in-progress state survives a toggle;
          the overlays simply cover it. */}
      {selectedFile && (<>
        <ViewTabs />
        {viewMode === '3d' && <ThreeView />}
        {viewMode === 'fds' && <FdsCodeView />}
        {viewMode === 'results' && <ReliabilityResultsView />}
      </>)}
      {showModePopup && <ModePopup setToggleShowPopup={setShowModePopup} onModeSelected={handleModeSelected}/>}
      <div>
        { isLoadingFromServer ? (
          <div className="flex flex-col items-center justify-center min-h-screen gap-4">
            <FDRobot hintText={'Loading project...'} />
          </div>
        ) : showDashboard && !needsName ? (
          <ProjectDashboard
            userName={userName}
            onSelectProject={handleSelectProject}
            onNewProject={handleNewProject}
            onEditName={() => {
              setNameInput(userName || '')
              clearName()
            }}
            onModeSwitch={handleModeSelected}
          />
        ) : selectedFile ? (<>
          <Canvas
            dimensions={canvasDimensions}
            isDevMode={dev_mode}
            />
        </>
        ) :
            <>
      <div>
        <label>
          <input
            id="image"
            name="image"
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
          />
        </label>
      </div>
              <FDRobot hintText={isContinuing ? 'Upload the same PDF to continue' : 'Please upload PDF'} />
            </>

              }
        {/* The PDF canvas stays mounted (renderPdf draws to it before
            setSelectedFile flips, so the ref must exist), but is hidden whenever
            no project is open — otherwise the previous project's PDF lingers
            behind the dashboard and the user has to scroll past it. */}
        <canvas
        ref={pdfCanvasRef}
        className={selectedFile ? 'z-1' : 'hidden'}
        />
      </div>
    </>
)
}
