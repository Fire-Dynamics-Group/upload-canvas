import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Gridlines from './Gridlines'
import ScalePopup from './ScalePopup'
import FDRobot from './FDRobot'
import { CSVLink } from 'react-csv'
import useStore from '../store/useStore'
import { calcDistance } from '@/utils/helperFunctions'
import { computeShaftRect } from '@/utils/shaftGeometry'
import { computeAutoSprinklerPositions } from '@/utils/autoSprinklers'
import { get } from 'http'

/**
 * 
 * TODO: have indication the mesh aligned with other mesh -> only colour subsections of mesh edge that align
 * bug: addiitonal meshes added when mesh changed size
 * 
 * 
 * bug: only allowing top left and bottom right for rect changing size
*/
const elementConfig = {
    "obstruction": "green",
    "mesh": "green",
    "stairObstruction": "blue",
    "stairMesh": "blue",
    "door": "red",
    "fire": "orange",
    "scale": "green",
    "selection": "orange",
    "escapeRoute": "blue",
    "opening": "blue",
    "inlet": "purple",
    "extract": "cyan",
    "landing": "blue",
    "sprinkler": "#3b82f6",
    "sensorTree": "#00ff88",
    "fsaSensor": "#ff9900"
}

// --- module-level pure helpers for point-alignment snap (testable from tests) ---
// These are additive siblings of the mesh-snap helpers inside the component.
// Do not merge with the mesh-snap path — that's a hard constraint.

function _isMeshEl(el) {
    return !!(el && el.comments && el.comments.toLowerCase().includes('mesh'))
}

function _getRectCornersModule(rectPoints) {
    const p1 = rectPoints[0]
    const p3 = rectPoints[1]
    const p2 = { x: p1.x, y: p3.y }
    const p4 = { x: p3.x, y: p1.y }
    let topLeft, bottomLeft, bottomRight, topRight
    if (p1.x > p3.x) {
        if (p1.y > p3.y) {
            topLeft = p1; bottomRight = p3; topRight = p4; bottomLeft = p2
        } else {
            topLeft = p2; bottomRight = p4; topRight = p3; bottomLeft = p1
        }
    } else {
        if (p1.y > p3.y) {
            topLeft = p4; bottomRight = p2; topRight = p1; bottomLeft = p3
        } else {
            topLeft = p3; bottomRight = p1; topRight = p2; bottomLeft = p4
        }
    }
    return [topLeft, bottomLeft, bottomRight, topRight]
}

/**
 * Collect X/Y coordinates from existing elements + in-progress vertices that
 * can act as alignment candidates for the point/polyline tools.
 *
 * Candidate sources:
 *   - polyline vertices (walls, doors, inlets, extracts, openings, etc.)
 *   - single-point elements (sensors, devices)
 *   - all 4 corners of mesh rectangles
 *   - in-progress vertices (currentPoly during polyline draw)
 *
 * `excludeId` filters out the element currently being drawn (if already
 * committed, which normally it's not, but kept as symmetric with mesh snap).
 */
export function collectPointAlignmentCoordinates(elements, excludeId = null, inProgressPoints = []) {
    const xCoords = []
    const yCoords = []
    for (const el of elements || []) {
        if (excludeId !== null && el.id === excludeId) continue
        if (el.type === 'polyline') {
            for (const p of el.points || []) {
                xCoords.push(p.x)
                yCoords.push(p.y)
            }
        } else if (el.type === 'point') {
            for (const p of el.points || []) {
                xCoords.push(p.x)
                yCoords.push(p.y)
            }
        } else if (el.type === 'rect' && _isMeshEl(el)) {
            const corners = _getRectCornersModule(el.points)
            for (const c of corners) {
                xCoords.push(c.x)
                yCoords.push(c.y)
            }
        }
    }
    for (const p of inProgressPoints || []) {
        if (p && typeof p.x === 'number' && typeof p.y === 'number') {
            xCoords.push(p.x)
            yCoords.push(p.y)
        }
    }
    return { xCoords, yCoords }
}

/**
 * Collect all elements whose closest vertex to `pointer` is within `threshold`
 * pixels. Returns a sorted list of candidates — nearest first, with bbox
 * diagonal as the tie-breaker so smaller (more specific) elements outrank
 * larger ones at the same cursor distance.
 *
 * Returned shape per candidate:
 *   {
 *     element: <the element itself, reference-equal to input>,
 *     pointerDown: {x, y}  // the closest vertex on the element to the cursor
 *     distance: number,    // px distance from cursor to that vertex
 *     bboxDiagonal: number // px length of the element's axis-aligned bbox diag
 *   }
 *
 * For mesh rects (`type === 'rect'` and comment contains 'mesh') the bbox is
 * computed from all four expanded corners, not the raw two-point diagonal.
 *
 * Sort key: (distance ascending, bboxDiagonal ascending). Stable Array#sort in
 * modern JS means equal-keyed entries keep their input order — so repeated
 * calls with the same inputs return an identical list (cycling needs this).
 */
export function collectSelectionCandidates(pointer, elements, threshold = 40) {
    const candidates = []
    for (const el of elements || []) {
        if (!el || !el.points || el.points.length === 0) continue
        const comments = (el.comments || '').toLowerCase()
        const isMeshRect = el.type === 'rect' && comments.includes('mesh')

        // Build the set of vertices to hit-test against for this element.
        const vertices = isMeshRect
            ? _getRectCornersModule(el.points)
            : el.points

        // Find this element's closest vertex to the pointer.
        let bestVertex = null
        let bestDistance = Infinity
        for (const v of vertices) {
            const dx = pointer.x - v.x
            const dy = pointer.y - v.y
            const d = Math.sqrt(dx * dx + dy * dy)
            if (d < bestDistance) {
                bestDistance = d
                bestVertex = v
            }
        }

        if (bestVertex === null || bestDistance > threshold) continue

        // Compute bbox diagonal from the full set of vertices (expanded for
        // mesh rects). For a mesh this gives the true rect diagonal rather
        // than whatever diagonal the two stored points happen to describe.
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        for (const v of vertices) {
            if (v.x < minX) minX = v.x
            if (v.y < minY) minY = v.y
            if (v.x > maxX) maxX = v.x
            if (v.y > maxY) maxY = v.y
        }
        const bboxDiagonal = Math.sqrt(
            (maxX - minX) * (maxX - minX) + (maxY - minY) * (maxY - minY)
        )

        candidates.push({
            element: el,
            pointerDown: bestVertex,
            distance: bestDistance,
            bboxDiagonal,
        })
    }

    // Primary sort: distance. Secondary: bbox diagonal. Both ascending.
    candidates.sort((a, b) => {
        if (a.distance !== b.distance) return a.distance - b.distance
        return a.bboxDiagonal - b.bboxDiagonal
    })

    return candidates
}

/**
 * Mirror of snapToMeshEdges: picks nearest candidate per-axis within
 * threshold, emits vertical/horizontal guides of the same shape the
 * canvas render block already understands.
 */
export function snapToPointAlignment(vertex, coordsResult, threshold) {
    const { xCoords, yCoords } = coordsResult
    const guides = []
    let snappedX = vertex.x
    let snappedY = vertex.y
    let bestDx = threshold + 1
    let bestDy = threshold + 1

    for (const x of xCoords) {
        const dx = Math.abs(vertex.x - x)
        if (dx < bestDx && dx <= threshold) {
            bestDx = dx
            snappedX = x
        }
    }
    for (const y of yCoords) {
        const dy = Math.abs(vertex.y - y)
        if (dy < bestDy && dy <= threshold) {
            bestDy = dy
            snappedY = y
        }
    }

    if (bestDx <= threshold) guides.push({ type: 'vertical', x: snappedX })
    if (bestDy <= threshold) guides.push({ type: 'horizontal', y: snappedY })

    return { snapped: { x: snappedX, y: snappedY }, guides }
}

// eslint-disable-next-line react/prop-types
function Canvas({dimensions, isDevMode}) {
    // TODO: have currentElement array with {} including type etc like elements
    const [currentPoly, setCurrentPoly] = useState([])
    const [currentRect, setCurrentRect] = useState([])
    const [currentPoint, setCurrentPoint] = useState([])

    const elements = useStore((state) => state.elements)
    const addElement = useStore((state) => state.addElement)
    const removeElement = useStore((state) => state.removeElement)
    const changeElement = useStore((state) => state.changeElement)
    const comment = useStore((state) => state.comment)
    const setComment = useStore((state) => state.setComment)
    const currentMode = useStore((state) => state.currentMode)
    const highlightedDoorId = useStore((state) => state.highlightedDoorId)
    const doorRoles = useStore((state) => state.doorRoles)
    const highlightedLandingId = useStore((state) => state.highlightedLandingId)
    const landingRoles = useStore((state) => state.landingRoles)
    const extractConfig = useStore((state) => state.extractConfig)
    const highlightedExtractId = useStore((state) => state.highlightedExtractId)
    const highlightedInletId = useStore((state) => state.highlightedInletId)
    const isSprinklered = useStore((state) => state.isSprinklered)
    const debugRects = useStore((state) => state.debugRects)
    const pixelsPerMesh = useStore((state) => state.pixelsPerMesh)
    const setPixelsPerMesh = useStore((state) => state.setPixelsPerMesh)


    const [isDrawing, setIsDrawing] = useState(false)
    
    // TODO: have a keyPressed useState -> with which key
    const [isUpPressed, setIsUpPressed] = useState(false)

    const [isCtrlPressed, setIsCtrlPressed] = useState(false)
    const [isShiftPressed, setIsShiftPressed] = useState(false)
    const [isEscapePressed, setIsEscapePressed] = useState(false)
    // on enter -> isDrawing = false
    // add polyline to state
    // add type of line -> include in useLayoutEffect canvas rendering
    const [isEnterPressed, setIsEnterPressed] = useState(false)
    const canvasRef = useRef(null)
    const [hasScale, setHasScale] = useState(false)
    const [scalePoints, setScalePoints] = useState([])
    const canvasWidth = dimensions.width
    const canvasHeight = dimensions.height
    // TODO: if drawing have line between penultimate point and cursor
    // have state that is true when drawing is true and mouse moving -> store mouse
    const [guideLine, setGuideLine] = useState(null)
    const [snapGuides, setSnapGuides] = useState([])
    // Selection disambiguation: when a click finds multiple candidates
    // under the cursor, keep the full sorted list around so the user can
    // Alt+click to cycle or click a chip in the picker overlay.
    const [candidateCycleState, setCandidateCycleState] = useState(null)
    const [currentId, setCurrentId] = useState(() => {
        if (elements.length === 0) return 0
        return Math.max(...elements.map(el => el.id)) + 1
    })
    const [xCounter, setXCounter] = useState(0)
    const [yCounter, setYCounter] = useState(0)

    // below logic for popup
    const [showPopup, setShowPopup] = useState(false)
    const [scaleDistance, setScaleDistance] = useState(null)
    const selectedElement = useStore((state) => state.selectedElement)
    const setSelectedElement = useStore((state) => state.setSelectedElement)

    const beingEditedElement = useStore((state) => state.beingEditedElement)
    const nullSelectedAndEditedElements = useStore((state) => state.nullSelectedAndEditedElements)


    const tool = useStore((state) => state.tool)
    const setTool = useStore((state) => state.setTool)



    // useCallback return memoized version of function -> only changes if dep val changes
    // therefore, not re-ran each re-render of useEffect
    const returnElementObject = useCallback((type, pointsArray, comments) => {
        let id = currentId 
        setCurrentId(prev => prev + 1)
        return {
            "type": type,
            "points": pointsArray,
            "comments": comments,
            "id": id,
            // "beingEdited": false // not rendered from elements if true -> editedElement in current logic e.g. currentPoly etc
        }          
    }, [currentId])

    // Sync hasScale with persisted pixelsPerMesh (rehydration + reset)
    useEffect(() => {
        setHasScale(pixelsPerMesh !== 1)
    }, [pixelsPerMesh])

    // Test hook: expose the zustand store on window in non-production builds so
    // e2e tests can inspect committed elements directly. No-op in prod bundle.
    useEffect(() => {
        if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
            window.__store = useStore
        }
    }, [])

    useEffect(() => {
        if (elements.length > 0) {
            const maxId = Math.max(...elements.map(el => el.id))
            setCurrentId(prev => Math.max(prev, maxId + 1))
        }
    }, [elements])

    // event listener for ctrl button
    // lines to be ortho -> check if closer to x or y ortho
    // LATER: move keypress to own component -> send back keys pressed or keyup
    useEffect(() => {


        const handleKeyPress = ({key}) => {
            // have arrow keys for controlling element location
            if (key == 'ArrowUp') {
                event.preventDefault();
                setIsUpPressed(true)
            }        
            if (key == 'Control') {
                setIsCtrlPressed(true)
            }
            if (key == 'Shift') {
                setIsShiftPressed(true)
            }
            if (key == 'Escape') {
                setIsEscapePressed(true)
                
                if (selectedElement && selectedElement["element"]) {
                    // remove selected element from elements
                    let selectedId = selectedElement["element"]["id"]
                    // console.log("filtered element: ", elements.filter(element => element.id !== selectedId))
                    removeElement(selectedId); // filter returns array of all items meeting condition
                    setSelectedElement(null)
                    setCandidateCycleState(null)
                }
            }
            // "Enter"
            if (key == 'Enter') {
                function addElementToState() {
                    // only needed for polyline?
                    if (tool == 'polyline') {
                        // if selection == true; then finalise position
                        if (currentPoly.length > 0 ) {
                            let current_el = returnElementObject(tool, currentPoly, comment)
                            addElement(current_el)
                            
                        }
                        // actions when first one drawn -> will guide be removed?
                        setIsDrawing(false)
                        setCurrentPoly([])
                    } 
                }

                // action adding polyline to state if applicable
                // clear current poly
                // comments to be added from user selection of drop down
                addElementToState()
                setIsEnterPressed(true)
                
              }
        };
        const handleCtrlRelease = ({key}) => {
            // console.log("keyup event: ",key)
            if (key == 'Control') {
                setIsCtrlPressed(false)
            }
            if (key == 'Shift') {
                setIsShiftPressed(false)
            }
            if (key == 'Escape') {
                setIsEscapePressed(false)
            }
            // "Enter"
            if (key == 'Enter') {
                setIsEnterPressed(false)
                }
        };

        window.addEventListener("keydown", handleKeyPress)
        window.addEventListener("keyup", handleCtrlRelease)

        return () => {
            window.removeEventListener("keydown", handleKeyPress)
            window.removeEventListener("keyup", handleCtrlRelease)
        }
    }, [elements, currentPoly, tool, setTool, comment, addElement, selectedElement, currentId, removeElement, returnElementObject, setSelectedElement])

    // LATER: move to own component -> sends back null or position object
    useEffect(() => {
        // TODO: guide rect for meshes
        const handleMouseMove = (event) => {
            // currentElement should have type and can include scale
            const isPolylineHover = tool === 'polyline' && (isDrawing && currentPoly.length > 0)
            const isPointHover = tool === 'point' && hasScale
            if (selectedElement || isDrawing && currentPoly.length > 0 || tool === 'scale' && scalePoints.length == 1 || tool === 'rect' && currentRect.length == 1) { // and tool == polyline
                event.preventDefault();
                if (tool === 'rect' && currentRect.length === 1 && comment && comment.toLowerCase().includes('mesh')) {
                    const raw = { x: event.pageX, y: event.pageY }
                    const { snapped, guides } = snapToMeshEdges(raw)
                    const hasXSnap = guides.some(g => g.type === 'vertical')
                    const hasYSnap = guides.some(g => g.type === 'horizontal')
                    const finalX = hasXSnap ? snapped.x : (Math.round(raw.x / pixelsPerMesh)) * pixelsPerMesh
                    const finalY = hasYSnap ? snapped.y : (Math.round(raw.y / pixelsPerMesh)) * pixelsPerMesh
                    setGuideLine({ x: finalX, y: finalY })
                    setSnapGuides(guides)
                } else if (isPolylineHover) {
                    // Live alignment guide preview for polyline draw (walls, doors, etc.)
                    const raw = { x: event.pageX, y: event.pageY }
                    if (isShiftPressed || currentMode === 'radiation') {
                        setGuideLine(raw)
                        setSnapGuides([])
                    } else {
                        const coords = collectPointAlignmentCoordinates(elements, null, currentPoly)
                        const { snapped, guides } = snapToPointAlignment(raw, coords, MESH_SNAP_THRESHOLD)
                        const hasXSnap = guides.some(g => g.type === 'vertical')
                        const hasYSnap = guides.some(g => g.type === 'horizontal')
                        const finalX = hasXSnap ? snapped.x : (Math.round(raw.x / pixelsPerMesh)) * pixelsPerMesh
                        const finalY = hasYSnap ? snapped.y : (Math.round(raw.y / pixelsPerMesh)) * pixelsPerMesh
                        setGuideLine({ x: finalX, y: finalY })
                        setSnapGuides(guides)
                    }
                } else {
                    setGuideLine({x: event.pageX, y: event.pageY})
                    setSnapGuides([])
                }
            } else if (isPointHover) {
                // Point tool: show alignment guides on hover even before click.
                event.preventDefault();
                const raw = { x: event.pageX, y: event.pageY }
                if (isShiftPressed || currentMode === 'radiation') {
                    setGuideLine(null)
                    setSnapGuides([])
                } else {
                    const coords = collectPointAlignmentCoordinates(elements, null, [])
                    const { guides } = snapToPointAlignment(raw, coords, MESH_SNAP_THRESHOLD)
                    setSnapGuides(guides)
                    setGuideLine(null)
                }
            } else {
                setGuideLine(null)
                setSnapGuides([])
            }
        };

        window.addEventListener("mousemove", handleMouseMove)

        return () => {
            window.removeEventListener("mousemove", handleMouseMove)
        }
    }, [isDrawing, currentPoly, scalePoints.length, tool, currentRect, selectedElement, comment, pixelsPerMesh, elements, isShiftPressed, currentMode, hasScale])

    function deltaGridlines(pxPerMesh, tool) { // actioned if debug mode and after scale set normally
        setPixelsPerMesh(pxPerMesh)
        setHasScale(true)
        setShowPopup(false)
        // change from scale mode to drawing mode
        setTool(tool)
        setComment("obstruction")
    }

    function handleScaleInput(inputDistance) {
        let scaleDistance = inputDistance
        let desiredScale = 0.1 //m - later be changeable
        let pixels = calcDistance(scalePoints[0], scalePoints[1])
        let temp = pixels / (scaleDistance / desiredScale)
        deltaGridlines(temp, 'polyline')
    }
 
    useLayoutEffect(() => {
        // TODO: render selectedElement
        // TODO: need to add finished polygon or points to object array
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')
        
        context.clearRect(0, 0, canvas.width, canvas.height)

        function linesSharePoint(line1Start, line1End, line2Start, line2End) {

            let line1minX = Math.round(Math.min(line1Start.x, line1End.x))
            let line1maxX = Math.round(Math.max(line1Start.x, line1End.x))
            let line1minY = Math.round(Math.min(line1Start.y, line1End.y))
            let line1maxY = Math.round(Math.max(line1Start.y, line1End.y))

            let line2minX = Math.round(Math.min(line2Start.x, line2End.x))
            let line2maxX = Math.round(Math.max(line2Start.x, line2End.x))
            let line2minY = Math.round(Math.min(line2Start.y, line2End.y))
            let line2maxY = Math.round(Math.max(line2Start.y, line2End.y))

            // TODO: return point of central intersection -> or colour lines?
            if (line1minY === line1maxY && line1maxY === line2minY && line2minY === line2maxY) {
                if (line1minX <= line2minX && line1maxX >= line2minX || line2minX <= line1minX && line2maxX >= line1minX) {
                    return true
                }
                if (line1minX <= line2maxX && line1maxX >= line2maxX || line2minX <= line1maxX && line2maxX >= line1maxX) {
                    return true
                }

            } 
            if (line1minX === line1maxX && line1maxX === line2minX && line2minX === line2maxX) {

                if (line1minY <= line2minY && line1maxY >= line2minY || line2minY <= line1minY && line2maxY >= line1minY) {
                    return true
                }
                if (line1minY <= line2maxY && line1maxY >= line2maxY || line2minY <= line1maxY && line2maxY >= line1maxY) {
                    return true
                }
            }

            return false
        }
        function areListsDifferent(list1, list2) {
            // Check if lists have different lengths
            if (list1.length !== list2.length) {
                return true;
            }
        
            for (let i = 0; i < list1.length; i++) {
                const obj1 = list1[i];
                const obj2 = list2[i];
        
                // Compare lengths of the x arrays
                if (obj1.x.length !== obj2.x.length) {
                    return true;
                }
        
                // Compare lengths of the y arrays
                if (obj1.y.length !== obj2.y.length) {
                    return true;
                }
        

                    if (Math.round(obj1.x) !== Math.round(obj2.x)) {
                        return true;
                    }


                    if (Math.round(obj1.y) !== Math.round(obj2.y)) {
                        return true;
                    }

            }
        
            return false;
        }
        
        // TODO: have indication if two meshes aligned -> perhaps a cross?
        function isMeshAligned(currentPoints, elements) { // probably finished shapes only
            // check if currentPoints align with any meshElements
            let currentCorners = getRectCorners(currentPoints)
            for (let i = 0; i < currentCorners.length; i++) {
                let currentStart = currentCorners[i]
                let currentEnd = currentCorners[(i+1)%4]
                for (let j = 0; j < elements.length; j++) {
                    if (isMesh(elements[j])) {
                        // all 4 sides of mesh
                        let checkCorners = getRectCorners(elements[j]["points"])
                        // check not the same element
                        if (areListsDifferent(checkCorners, currentCorners)) {
                            for (let k = 0; k < checkCorners.length; k++) {
                                let checkStart = checkCorners[k]
                                let checkEnd = checkCorners[(k+1)%4]
                                // check if any of the sides align
                                if (linesSharePoint(currentStart, currentEnd, checkStart, checkEnd)) {
                                    return {"isAligned":true, keyPoints: [currentStart, currentEnd, checkStart, checkEnd]}; // need side that aligns
                                    // later only return subsection that overlaps the other line
                                }
                            }

                        }
                    }
                }
            }
            return {"isAligned":false, keyPoints: null}
        }

        function drawRect(points, context, comments, dotted=false) {
            let p1 = points[0]
            let p2 = points[1]
            let deltaX = p2.x - p1.x
            let deltaY = p2.y - p1.y
            context.strokeStyle = elementConfig[comments] 
            context.lineWidth = 1.5;
            if (dotted) {
                context.setLineDash([5, 15])
                context.lineWidth = 2;
            }
            context.strokeRect(p1.x, p1.y, deltaX, deltaY)

            context.lineWidth = 1;
            context.setLineDash([])


        }

        function drawRectAndGuide(points, context, comments, dotted=true) { 
            // need if beingEdited
            if (selectedElement) {
                // change polypoints before drawing
                // if beingEdited
                // use guideLine for selectedPoint
                
                
                // TODO: overule mouse move if one of wasd are pressed 
                let startingPointPosition = selectedElement["pointerDown"]
                if (guideLine != null) {
                    let current = guideLine
                    // bug: top right and bottom left corners change whilst mouse is close to corner but not after that??
                    // below get 4 corners of rect
                    // then offset corners accordingly to mouse movement
                    // before sending back top left and bottom right corners to be drawn
                    let rectPoints = getRectCorners(points)
                    // if wasd pressed: offset by one cell in appropriate direction
                    let isWasdPressed = true
                    let offsetPoints
                    if (isWasdPressed) {
                        // how much is one cell: test up
                        setXCounter(prev => prev + 1)
                        offsetPoints = addOffsetToRectPoints(rectPoints, 0, 100, startingPointPosition.x, startingPointPosition.y)

                    } else {

                        offsetPoints = addOffsetToRectPoints(rectPoints, current.x - startingPointPosition.x, current.y - startingPointPosition.y, startingPointPosition.x, startingPointPosition.y)
                    }
                    points = offsetPoints
                }
                drawRect(points, context, comments, dotted)

            } else {
                // unclear when guidline would not be null and not selectedElement - when drawing and not in state yet
                let rectPoints = getRectCorners(points)
                points = [rectPoints[0], rectPoints[2]]
                drawRect(points, context, comments, dotted)

                if (guideLine != null) {
                    // line from last rect point to guideline
                    let prev = points[points.length-1]
                    let current = guideLine
                    // check if current is maxX, minX, maxY, minY
                    if (isCtrlPressed){
                        current = snapVertexOrtho(current, prev)
                    }
                    context.moveTo(prev.x, prev.y)
                    context.lineTo(current.x, current.y)
                    context.stroke()            
                }

            }
        }

        function drawPolyline(points, context, comments) {
            // TODO: have all the options in an object, not just colours
            for (let i=0; i<points.length; i++) {
                // draw vertex
                if (currentMode === 'fdsGen' || comments === 'fire') {

                    let dimension = 10
                    // bug when fire point selected and shifted
                    // no comments available
                    context.fillStyle = elementConfig[comments] // have config depending on comment
                    context.fillRect(points[i].x - dimension/2, points[i].y - dimension/2, dimension, dimension)  
                }
    
                // if i> 0 draw lines between points
                if (i == 0){
                context.beginPath()}
                if (i > 0) {
                    let prev = points[i-1]
                    let current = points[i]
                    context.strokeStyle = (currentMode === 'fdsGen') ? 'black' : elementConfig[comments] // depending on mode if radiation use comment for optionsObject
                    context.lineWidth = (currentMode === 'fdsGen') ? 1 : 4; // depending on mode if radiation use 2 else 1
                    context.moveTo(prev.x, prev.y)
                    context.lineTo(current.x, current.y)
                    context.stroke()
                }
    
            }            
        }
        function drawPolyAndGuide(poly, comment, context) {
                    
            // need if beingEdited
            if (selectedElement) {
                // change polypoints before drawing
                // if beingEdited
                // use guideLine for selectedPoint
                // 
                let startingPointPosition = selectedElement["pointerDown"]
                if (guideLine != null) {
                    let current = guideLine
                    for (let i = 0; i < poly.length; i++) {
                        let point = poly[i]
                        if (point == startingPointPosition) {
                            poly[i].x = current.x
                            poly[i].y = current.y 
                        }
                    }
                }
                drawPolyline(poly, context, comment)

            } else {
                drawPolyline(poly, context, comment)

                // Draw a larger circle on the first point when >= 3 points
                // to indicate the close target
                if (poly.length >= 3) {
                    context.beginPath()
                    context.arc(poly[0].x, poly[0].y, 6, 0, Math.PI * 2)
                    context.fillStyle = '#00ff00'
                    context.fill()
                }

                if (guideLine != null) {
                    // line from last polypoint to guideline
                    let prev = poly[poly.length-1]
                    let current = guideLine
                    if (isCtrlPressed){
                        current = snapVertexOrtho(current, prev)
                    }
                    context.moveTo(prev.x, prev.y)
                    context.lineTo(current.x, current.y)
                    context.stroke()

                    // Snap-to-close indicator: when cursor is near the first
                    // point with >= 3 points drawn, show a green circle and
                    // dashed line to signal the polygon will close on click
                    const CLOSE_SNAP_PX = 15
                    if (poly.length >= 3 && calcDistance(current, poly[0]) < CLOSE_SNAP_PX) {
                        // Highlight the start point with a snap circle
                        context.beginPath()
                        context.arc(poly[0].x, poly[0].y, 8, 0, Math.PI * 2)
                        context.strokeStyle = '#00ff00'
                        context.lineWidth = 2
                        context.stroke()
                        // Dashed line from last point to start
                        context.beginPath()
                        context.setLineDash([4, 4])
                        context.moveTo(prev.x, prev.y)
                        context.lineTo(poly[0].x, poly[0].y)
                        context.strokeStyle = '#00ff00'
                        context.stroke()
                        context.setLineDash([])
                    }
                }

            }
        }
        if (selectedElement) {
            // draw dashed box around element
            let selectedPoints = selectedElement["element"]["points"]
            let selectedType = selectedElement["element"]["type"]
            let rectOutlinePoints = (selectedType === 'rect') ? selectedPoints : [selectedElement["pointerDown"]]
            // if mesh/rect then needs to use delta for max and min y
            // find points
            let maxX = null
            let minX = null
            let maxY = null
            let minY = null

            if (selectedType === 'rect') {
                rectOutlinePoints = getRectCorners(rectOutlinePoints)
            }
            // find bottom left, right, top left and right
            for (let i = 0; i < rectOutlinePoints.length; i++) {
                let currentX = rectOutlinePoints[i].x
                let currentY = rectOutlinePoints[i].y
                if (maxX == null || maxX < currentX) {
                    maxX = currentX
                }
                if (maxY == null || maxY < currentY) {
                    maxY = currentY
                }
                if (minX == null || minX > currentX) {
                    minX = currentX
                }
                if (minY == null || minY > currentY) {
                    minY = currentY
                }                
            }

            let buffer = 10
            maxX += buffer
            maxY += buffer
            minX -= buffer
            minY -= buffer
            // add buffer
            // draw dotted line rect
            let selectedRectPoints = [{"x": maxX, "y": maxY}, {"x": minX, "y": minY}]
            let comments = "selection"
            drawRect(selectedRectPoints, context, comments, true)

            // draw intermediate for selected shape
            // let selectedType = selectedElement["element"]["type"]

            // need to setComment when selection
            if (selectedType === 'polyline') {
                drawPolyAndGuide(selectedPoints, comment, context)
            } else if (selectedType === 'point'){
                // should use guide
                drawPolyAndGuide(selectedPoints, "fire", context)
                // drawPolyline(selectedPoints, context,"fire") // should just add to state
            } else if (selectedType == 'rect') {

                drawRectAndGuide(selectedPoints, context, comment)

                
        //     if (selectedElement["element"]["type"] === 'polyline') {
        //         drawPolyAndGuide(currentPoly, comment)
        //     // later have contrasting colour
        }
    }

        // loop through current polypoints
        if (isDrawing) {

                // should be current element with type and points object
                // logic should allow guide to not be final point

                
                if (tool === 'polyline') {
                    drawPolyAndGuide(currentPoly, comment, context)
                // } else if (selectedElement) {
                //     drawPolyAndGuide(selectedElement["element"]["points"], tool)
                }else if (tool === 'scale') {
                    // without context in this case!!
                    drawPolyAndGuide(scalePoints, tool, context)
                } else if (tool === 'point'){
                    drawPolyline(currentPoint, context, comment) // should just add to state
                } else if (tool == 'rect') {
                    if (currentRect.length == 1) {
                        // use guide for mousePosition
                        if (guideLine != null) {

                            // have guide point for rect -> send to draw rect
                            // likely need to add offset to rect points
                            // get rect corners first etc
                            let rectPoints = [currentRect[0], guideLine]
                            drawRect(rectPoints, context, comment)
                        }
                    }
                }

        }

        // Pre-compute indices for numbered labels
        const doorElements = elements.filter(el => el.comments === 'door')
        const extractElements = elements.filter(el => el.comments === 'extract')
        const inletElements = elements.filter(el => el.comments === 'inlet')

        // all historical elements
        // later have different logic for different line types
        elements.forEach(element => {
            if (!selectedElement ||selectedElement && element.id != selectedElement.id) { // if element is selected -> include in current poly etc

                // later access comment -> different line colour etc
                if (element.type == 'polyline' || element.type == 'scale') {   
                    drawPolyline(element.points, context, element.comments)
                } else if (element.type == 'rect') {
                    // TODO: check if mesh aligns with other mesh edges -> perhaps a cross? or colour change edge
                    drawRect(element.points, context, element.comments)
                                // signal if mesh is aligned with other mesh
            // console.log("checking alignment")
            if (isMesh(element)) { 
                let alignedObject = isMeshAligned(element.points, elements)
                if (alignedObject["isAligned"]) { 
                    // draw cross
                    let keyPoints = alignedObject["keyPoints"]
                    let p1 = keyPoints[0]
                    let p2 = keyPoints[1]
                    let p3 = keyPoints[2]
                    let p4 = keyPoints[3]
                    context.strokeStyle = "red"
                    context.beginPath()
                    context.moveTo(p1.x, p1.y)
                    context.lineTo(p2.x, p2.y)
                    context.strokeStyle = "yellow"
                    context.moveTo(p3.x, p3.y)
                    context.lineTo(p4.x, p4.y)
                    context.stroke()
                }
            }
                } else if (element.type == 'point') {
                    if (element.comments === 'sensorTree') {
                        // Draw bullseye icon (concentric circles)
                        const p = element.points[0]
                        const color = elementConfig['sensorTree']
                        // Outer ring
                        context.beginPath()
                        context.arc(p.x, p.y, 8, 0, Math.PI * 2)
                        context.strokeStyle = color
                        context.lineWidth = 1.5
                        context.stroke()
                        // Middle ring
                        context.beginPath()
                        context.arc(p.x, p.y, 5, 0, Math.PI * 2)
                        context.stroke()
                        // Centre dot
                        context.beginPath()
                        context.arc(p.x, p.y, 2, 0, Math.PI * 2)
                        context.fillStyle = color
                        context.fill()
                        context.lineWidth = 1
                    } else if (element.comments === 'fsaSensor') {
                        // Draw FSA sensor as diamond with distance label
                        const p = element.points[0]
                        const color = elementConfig['fsaSensor']
                        const size = 10
                        // Diamond shape
                        context.beginPath()
                        context.moveTo(p.x, p.y - size)
                        context.lineTo(p.x + size, p.y)
                        context.lineTo(p.x, p.y + size)
                        context.lineTo(p.x - size, p.y)
                        context.closePath()
                        context.strokeStyle = color
                        context.lineWidth = 2
                        context.stroke()
                        context.fillStyle = color
                        context.globalAlpha = 0.3
                        context.fill()
                        context.globalAlpha = 1.0
                        // Distance label
                        if (element.fsaDistance) {
                            context.font = 'bold 11px sans-serif'
                            context.fillStyle = color
                            context.fillText(`${element.fsaDistance}m`, p.x + size + 3, p.y + 4)
                        }
                        context.lineWidth = 1
                    } else {
                        drawPolyline(element.points, context, element.comments)
                    }
                }

                // Draw highlight ring + role label for highlighted or role-assigned doors
                if (element.comments === 'door') {
                    const isHighlighted = highlightedDoorId === element.id
                    const role = doorRoles[element.id]

                    // Always-open doors: redraw with green solid line
                    if (role === 'always_open') {
                        const pts = element.points
                        context.beginPath()
                        context.strokeStyle = 'green'
                        context.lineWidth = 3
                        context.moveTo(pts[0].x, pts[0].y)
                        context.lineTo(pts[1].x, pts[1].y)
                        context.stroke()
                        context.lineWidth = 1
                    }

                    // Leakage-only doors: redraw with orange dashed line
                    if (role === 'leakage' && element.points.length >= 2) {
                        const pts = element.points
                        context.beginPath()
                        context.setLineDash([6, 4])
                        context.strokeStyle = 'orange'
                        context.lineWidth = 3
                        context.moveTo(pts[0].x, pts[0].y)
                        context.lineTo(pts[1].x, pts[1].y)
                        context.stroke()
                        context.setLineDash([])
                        context.lineWidth = 1
                    }

                    if (element.points.length >= 2) {
                        const pts = element.points
                        const cx = (pts[0].x + pts[1].x) / 2
                        const cy = (pts[0].y + pts[1].y) / 2
                        const doorIdx = doorElements.indexOf(element) + 1
                        if (isHighlighted) {
                            context.beginPath()
                            context.arc(cx, cy, 20, 0, Math.PI * 2)
                            context.strokeStyle = 'yellow'
                            context.lineWidth = 3
                            context.stroke()
                            context.lineWidth = 1
                        }
                        // Always show numbered label; append role if assigned
                        const roleText = role === 'leakage' ? 'Leakage' : role === 'always_open' ? 'Always Open' : role ? role.charAt(0).toUpperCase() + role.slice(1) : ''
                        const label = `Door ${doorIdx}${roleText ? ' - ' + roleText : ''}`
                        context.font = '11px sans-serif'
                        context.fillStyle = isHighlighted ? 'yellow' : (role === 'leakage' ? 'orange' : role === 'always_open' ? 'green' : 'white')
                        context.strokeStyle = 'black'
                        context.lineWidth = 3
                        context.strokeText(label, cx + 12, cy - 12)
                        context.fillText(label, cx + 12, cy - 12)
                        context.lineWidth = 1
                    }
                }

                // Draw extract label + shaft rectangle
                if (element.comments === 'extract') {
                    const pts = element.points
                    const cx = (pts[0].x + pts[1].x) / 2
                    const cy = (pts[0].y + pts[1].y) / 2
                    const extractIdx = extractElements.indexOf(element) + 1
                    const isExtHighlighted = highlightedExtractId === element.id
                    const config = extractConfig[element.id] || {}
                    const shaftDepthM = config.shaftDepth || 0.9
                    // Convert metres to pixels: pixelsPerMesh * 10 gives px per metre
                    const pxPerM = pixelsPerMesh * 10
                    const shaftDepthPx = shaftDepthM * pxPerM

                    // Compute corridor centroid for shaft direction
                    const obstructions = elements.filter(el => el.comments === 'obstruction')
                    let corridorCentroid = null
                    if (obstructions.length > 0) {
                        let sumX = 0, sumY = 0, count = 0
                        obstructions.forEach(obs => {
                            obs.points.forEach(p => { sumX += p.x; sumY += p.y; count++ })
                        })
                        corridorCentroid = { x: sumX / count, y: sumY / count }
                    }

                    // Draw shaft rectangle
                    const shaftRect = computeShaftRect(pts, shaftDepthPx, corridorCentroid)
                    if (shaftRect) {
                        context.beginPath()
                        context.moveTo(shaftRect[0].x, shaftRect[0].y)
                        context.lineTo(shaftRect[1].x, shaftRect[1].y)
                        context.lineTo(shaftRect[2].x, shaftRect[2].y)
                        context.lineTo(shaftRect[3].x, shaftRect[3].y)
                        context.closePath()
                        context.fillStyle = 'rgba(6, 182, 212, 0.15)'
                        context.fill()
                        context.strokeStyle = isExtHighlighted ? 'yellow' : 'cyan'
                        context.lineWidth = isExtHighlighted ? 3 : 1
                        context.stroke()
                        context.lineWidth = 1
                    }

                    // Highlight ring
                    if (isExtHighlighted) {
                        context.beginPath()
                        context.arc(cx, cy, 20, 0, Math.PI * 2)
                        context.strokeStyle = 'yellow'
                        context.lineWidth = 3
                        context.stroke()
                        context.lineWidth = 1
                    }

                    // Label
                    const typeLabel = config.type === 'mechanical' ? 'Mech' : 'Nat'
                    const label = `Extract ${extractIdx} (${typeLabel})`
                    context.font = '11px sans-serif'
                    context.fillStyle = isExtHighlighted ? 'yellow' : 'cyan'
                    context.strokeStyle = 'black'
                    context.lineWidth = 3
                    context.strokeText(label, cx + 12, cy - 12)
                    context.fillText(label, cx + 12, cy - 12)
                    context.lineWidth = 1
                }

                // Draw inlet label
                if (element.comments === 'inlet') {
                    const pts = element.points
                    const cx = (pts[0].x + pts[1].x) / 2
                    const cy = (pts[0].y + pts[1].y) / 2
                    const inletIdx = inletElements.indexOf(element) + 1
                    const isInletHighlighted = highlightedInletId === element.id

                    if (isInletHighlighted) {
                        context.beginPath()
                        context.arc(cx, cy, 20, 0, Math.PI * 2)
                        context.strokeStyle = 'yellow'
                        context.lineWidth = 3
                        context.stroke()
                        context.lineWidth = 1
                    }

                    const label = `Inlet ${inletIdx}`
                    context.font = '11px sans-serif'
                    context.fillStyle = isInletHighlighted ? 'yellow' : '#a855f7'
                    context.strokeStyle = 'black'
                    context.lineWidth = 3
                    context.strokeText(label, cx + 12, cy - 12)
                    context.fillText(label, cx + 12, cy - 12)
                    context.lineWidth = 1
                }

                // Draw manually-placed sprinkler with circle+cross icon
                if (element.comments === 'sprinkler') {
                    const pt = element.points[0]
                    const sprinklerElements = elements.filter(el => el.comments === 'sprinkler')
                    const sprIdx = sprinklerElements.indexOf(element) + 1
                    // Blue circle with cross
                    context.beginPath()
                    context.arc(pt.x, pt.y, 8, 0, Math.PI * 2)
                    context.strokeStyle = '#3b82f6'
                    context.lineWidth = 2
                    context.stroke()
                    context.beginPath()
                    context.moveTo(pt.x - 5, pt.y)
                    context.lineTo(pt.x + 5, pt.y)
                    context.moveTo(pt.x, pt.y - 5)
                    context.lineTo(pt.x, pt.y + 5)
                    context.stroke()
                    context.lineWidth = 1
                    // Label
                    context.font = '9px sans-serif'
                    context.fillStyle = '#3b82f6'
                    context.strokeStyle = 'black'
                    context.lineWidth = 2
                    context.strokeText(`SPRK${sprIdx}`, pt.x + 10, pt.y + 3)
                    context.fillText(`SPRK${sprIdx}`, pt.x + 10, pt.y + 3)
                    context.lineWidth = 1
                }

                // Draw highlight ring + role label for highlighted or role-assigned landings
                if (element.comments === 'landing') {
                    const isHighlighted = highlightedLandingId === element.id
                    const role = landingRoles[element.id]
                    if (isHighlighted || role) {
                        const pts = element.points
                        const cx = (pts[0].x + pts[1].x) / 2
                        const cy = (pts[0].y + pts[1].y) / 2
                        if (isHighlighted) {
                            context.beginPath()
                            context.arc(cx, cy, 20, 0, Math.PI * 2)
                            context.strokeStyle = 'yellow'
                            context.lineWidth = 3
                            context.stroke()
                            context.lineWidth = 1
                        }
                        if (role) {
                            const label = role === 'floor' ? 'Floor Landing' : 'Half Landing'
                            context.font = '11px sans-serif'
                            context.fillStyle = isHighlighted ? 'yellow' : 'white'
                            context.strokeStyle = 'black'
                            context.lineWidth = 3
                            context.strokeText(label, cx + 12, cy - 12)
                            context.fillText(label, cx + 12, cy - 12)
                            context.lineWidth = 1
                        }
                    }
                }
            }
        })

        // Debug: draw decomposed rectangles
        if (debugRects && debugRects.length >= 4) {
            const colors = ['rgba(255,0,0,0.3)', 'rgba(0,0,255,0.3)', 'rgba(255,255,0,0.3)', 'rgba(0,255,255,0.3)', 'rgba(255,0,255,0.3)', 'rgba(128,255,0,0.3)']
            for (let i = 0; i < debugRects.length; i += 4) {
                const x = debugRects[i]
                const xMax = debugRects[i + 1]
                const y = debugRects[i + 2]
                const yMax = debugRects[i + 3]
                const color = colors[(i / 4) % colors.length]
                context.fillStyle = color
                context.fillRect(x, y, xMax - x, yMax - y)
                context.strokeStyle = 'red'
                context.lineWidth = 1
                context.strokeRect(x, y, xMax - x, yMax - y)
            }
        }

        // Draw auto-placed sprinkler markers only when no manual sprinklers exist
        if (isSprinklered && elements.filter(el => el.comments === 'sprinkler').length === 0) {
            const sprinklerPositions = computeAutoSprinklerPositions(elements, pixelsPerMesh)
            if (sprinklerPositions.length > 0) {
                sprinklerPositions.forEach((sp, i) => {
                    // Blue circle with cross
                    context.beginPath()
                    context.arc(sp.x, sp.y, 8, 0, Math.PI * 2)
                    context.strokeStyle = '#3b82f6'
                    context.lineWidth = 2
                    context.stroke()
                    // Cross inside
                    context.beginPath()
                    context.moveTo(sp.x - 5, sp.y)
                    context.lineTo(sp.x + 5, sp.y)
                    context.moveTo(sp.x, sp.y - 5)
                    context.lineTo(sp.x, sp.y + 5)
                    context.stroke()
                    context.lineWidth = 1
                    // Label
                    context.font = '9px sans-serif'
                    context.fillStyle = '#3b82f6'
                    context.strokeStyle = 'black'
                    context.lineWidth = 2
                    context.strokeText(`SPRK${i + 1}`, sp.x + 10, sp.y + 3)
                    context.fillText(`SPRK${i + 1}`, sp.x + 10, sp.y + 3)
                    context.lineWidth = 1
                })
            }
        }

        // Draw mesh snap guide lines
        if (snapGuides.length > 0) {
            context.save()
            context.setLineDash([4, 4])
            context.strokeStyle = '#ff00ff'
            context.lineWidth = 1
            for (const guide of snapGuides) {
                context.beginPath()
                if (guide.type === 'vertical') {
                    context.moveTo(guide.x, 0)
                    context.lineTo(guide.x, canvas.height)
                } else if (guide.type === 'horizontal') {
                    context.moveTo(0, guide.y)
                    context.lineTo(canvas.width, guide.y)
                }
                context.stroke()
            }
            context.restore()
        }

    }, [currentPoly, guideLine, isCtrlPressed, isDrawing, elements, scalePoints, tool, currentRect, currentPoint, comment, selectedElement, currentMode, highlightedDoorId, doorRoles, highlightedLandingId, landingRoles, extractConfig, highlightedExtractId, highlightedInletId, isSprinklered, pixelsPerMesh, debugRects, snapGuides])

    // Generate thumbnail by compositing PDF + drawing canvases
    const thumbnailTimerRef = useRef(null)
    const pdfCanvasRef = useStore((state) => state.pdfCanvasRef)
    const setThumbnail = useStore((state) => state.setThumbnail)

    useEffect(() => {
        if (!canvasRef.current || !pdfCanvasRef?.current) return
        // Debounce thumbnail generation to avoid doing it on every frame
        if (thumbnailTimerRef.current) clearTimeout(thumbnailTimerRef.current)
        thumbnailTimerRef.current = setTimeout(() => {
            try {
                const pdfCanvas = pdfCanvasRef.current
                const drawCanvas = canvasRef.current
                const thumbWidth = 400
                const aspect = pdfCanvas.height / pdfCanvas.width
                const thumbHeight = Math.round(thumbWidth * aspect)

                const offscreen = document.createElement('canvas')
                offscreen.width = thumbWidth
                offscreen.height = thumbHeight
                const ctx = offscreen.getContext('2d')
                ctx.drawImage(pdfCanvas, 0, 0, thumbWidth, thumbHeight)
                ctx.drawImage(drawCanvas, 0, 0, thumbWidth, thumbHeight)

                const dataUrl = offscreen.toDataURL('image/jpeg', 0.6)
                setThumbnail(dataUrl)
            } catch (e) {
                // Silently fail — thumbnail is non-critical
            }
        }, 1000)
        return () => { if (thumbnailTimerRef.current) clearTimeout(thumbnailTimerRef.current) }
    }, [elements, pdfCanvasRef, setThumbnail])

    function isMesh(currentEl) {
        if (currentEl["comments"].toLowerCase().includes("mesh")) {                       
            return true
        }        
        return false
    }

    function getRectCorners(rectPoints) {
        // works when first point is top left
        let p1 = rectPoints[0]
        let p3 = rectPoints[1]
        let p2 = {"x":p1.x, "y": p3.y}
        let p4 = {"x":p3.x, "y": p1.y}
        let topLeft, bottomLeft, bottomRight, topRight = null
        if (p1.x > p3.x) {
            if (p1.y > p3.y) {
                topLeft = p1
                bottomRight = p3
                topRight = p4
                bottomLeft = p2
            } else {
                topLeft = p2
                bottomRight = p4
                topRight = p3
                bottomLeft = p1
            
            }
        } else {
            if (p1.y > p3.y) {
                topLeft = p4
                bottomRight = p2
                topRight = p1
                bottomLeft = p3
            } else {
                topLeft = p3
                bottomRight = p1
                topRight = p2
                bottomLeft = p4
            }
        }
        // return top left, bottom left, bottom right, top right
        return [topLeft, bottomLeft, bottomRight, topRight]
    }

    function snapVertexOrtho(vertex, prevVertex) {
        // check if diff is greater in x or y between vertices
        const deltaX = Math.abs(prevVertex.x - vertex.x)
        const deltaY = Math.abs(prevVertex.y - vertex.y)

        if (deltaX < deltaY) {
            vertex.x = prevVertex.x
        } else {
            vertex.y = prevVertex.y
        }
        return vertex

    }
    function snapVertexToGrid(vertex) {
        if (currentMode === 'radiation') return vertex
        // snap to grid using pixels per mesh -> use 1
        vertex.x = (Math.round(vertex.x / pixelsPerMesh)) * pixelsPerMesh
        vertex.y = (Math.round(vertex.y / pixelsPerMesh)) * pixelsPerMesh

        return vertex
    }

    const MESH_SNAP_THRESHOLD = 15 // pixels

    function collectMeshEdgeCoordinates(excludeId = null) {
        const xCoords = []
        const yCoords = []
        for (const el of elements) {
            if (!isMesh(el)) continue
            if (excludeId !== null && el.id === excludeId) continue
            const corners = getRectCorners(el.points)
            const minX = Math.min(corners[0].x, corners[2].x)
            const maxX = Math.max(corners[0].x, corners[2].x)
            const minY = Math.min(corners[0].y, corners[2].y)
            const maxY = Math.max(corners[0].y, corners[2].y)
            xCoords.push(minX, maxX)
            yCoords.push(minY, maxY)
        }
        return { xCoords, yCoords }
    }

    function snapToMeshEdges(vertex, excludeId = null) {
        const { xCoords, yCoords } = collectMeshEdgeCoordinates(excludeId)
        const guides = []
        let snappedX = vertex.x
        let snappedY = vertex.y
        let bestDx = MESH_SNAP_THRESHOLD + 1
        let bestDy = MESH_SNAP_THRESHOLD + 1

        for (const x of xCoords) {
            const dx = Math.abs(vertex.x - x)
            if (dx < bestDx && dx <= MESH_SNAP_THRESHOLD) {
                bestDx = dx
                snappedX = x
            }
        }
        for (const y of yCoords) {
            const dy = Math.abs(vertex.y - y)
            if (dy < bestDy && dy <= MESH_SNAP_THRESHOLD) {
                bestDy = dy
                snappedY = y
            }
        }

        if (bestDx <= MESH_SNAP_THRESHOLD) guides.push({ type: 'vertical', x: snappedX })
        if (bestDy <= MESH_SNAP_THRESHOLD) guides.push({ type: 'horizontal', y: snappedY })

        return { snapped: { x: snappedX, y: snappedY }, guides }
    }

    function snapVertexWithMeshPriority(vertex, excludeId = null) {
        const { snapped, guides } = snapToMeshEdges(vertex, excludeId)
        const hasXSnap = guides.some(g => g.type === 'vertical')
        const hasYSnap = guides.some(g => g.type === 'horizontal')
        if (!hasXSnap) snapped.x = (Math.round(snapped.x / pixelsPerMesh)) * pixelsPerMesh
        if (!hasYSnap) snapped.y = (Math.round(snapped.y / pixelsPerMesh)) * pixelsPerMesh
        setSnapGuides(guides)
        return snapped
    }

    // Sibling of snapVertexWithMeshPriority for the polyline/point tools.
    // Tries alignment with existing element vertices + in-progress points
    // (enabling the 2nd door click / Nth polyline vertex to align with
    // earlier clicks of the same draw), then falls back to grid per-axis.
    //
    // Shift-held suppresses alignment and goes straight to grid.
    // In radiation mode, vertex is returned unchanged (match snapVertexToGrid).
    function snapVertexWithPointPriority(vertex, excludeId = null, inProgressPoints = [], suppressAlignment = false) {
        if (currentMode === 'radiation') {
            setSnapGuides([])
            return vertex
        }
        if (suppressAlignment) {
            vertex.x = (Math.round(vertex.x / pixelsPerMesh)) * pixelsPerMesh
            vertex.y = (Math.round(vertex.y / pixelsPerMesh)) * pixelsPerMesh
            setSnapGuides([])
            return vertex
        }
        const coords = collectPointAlignmentCoordinates(elements, excludeId, inProgressPoints)
        const { snapped, guides } = snapToPointAlignment(vertex, coords, MESH_SNAP_THRESHOLD)
        const hasXSnap = guides.some(g => g.type === 'vertical')
        const hasYSnap = guides.some(g => g.type === 'horizontal')
        if (!hasXSnap) snapped.x = (Math.round(snapped.x / pixelsPerMesh)) * pixelsPerMesh
        if (!hasYSnap) snapped.y = (Math.round(snapped.y / pixelsPerMesh)) * pixelsPerMesh
        setSnapGuides(guides)
        return snapped
    }

    //   TODO: polyline and mark point tools
    function handlePointerDown(event) { // should this be handle mouse down?
        // event.preventDefault(); 
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')
        if (tool === 'point') {
            context.fillStyle = 'blue'

            let dimension = 5

            let newP = {x: event.pageX, y: event.pageY}
            newP = snapVertexWithPointPriority(newP, null, [], isShiftPressed)
            let currentEl = returnElementObject(tool, [newP], comment) // comment from props
            // setElements(prev => [...prev, currentEl])
            addElement(currentEl)
            context.fillRect(newP.x - dimension/2, newP.y - dimension/2, dimension, dimension)        
        }
        else if (tool === 'polyline') {
            if (comment === 'door' || comment === 'inlet' || comment === 'extract') {
                if (currentPoly.length < 2) {
                    let prevIndex = currentPoly.length
                    setIsDrawing(true) 
                    let dimension = 10
                    context.fillStyle = elementConfig[comment] || elementConfig["door"]
                    // // draw vertex
                    let newP = {x: event.pageX, y: event.pageY}
                    // if ctrl pressed -> next point ortho
                    if (isCtrlPressed && currentPoly.length > 0) { // and not first point
                        newP = snapVertexOrtho(newP, currentPoly[currentPoly.length-1])
                    }
                    newP = snapVertexWithPointPriority(newP, null, currentPoly, isShiftPressed)
                    context.fillRect(newP.x - dimension/2, newP.y - dimension/2, dimension, dimension)
                    if (prevIndex === 1) {
                        // add element
                        // reset currentPoly
                        let current_el = returnElementObject(tool, [currentPoly[0], newP], comment)
                        addElement(current_el)
                        setIsDrawing(false)
                        setCurrentPoly([])
                        setSnapGuides([])
                    } else {
                        setCurrentPoly((prev) => [...prev, newP])
                    }
                }
            } else {
                setIsDrawing(true)
                // draw vertex
                let dimension = 10
                context.fillStyle = 'green'
                let newP = {x: event.pageX, y: event.pageY}
                // if ctrl pressed -> next point ortho
                if (isCtrlPressed && currentPoly.length > 0) { // and not first point
                    newP = snapVertexOrtho(newP, currentPoly[currentPoly.length-1])
                }
                newP = snapVertexWithPointPriority(newP, null, currentPoly, isShiftPressed)

                // Snap-to-close: if clicking near the first point with >= 3 points,
                // close the polygon and finalize (like Figma/Bluebeam)
                const CLOSE_SNAP_PX = 15
                if (currentPoly.length >= 3 && calcDistance(newP, currentPoly[0]) < CLOSE_SNAP_PX) {
                    // Close by adding first point, finalize the element
                    const closedPoly = [...currentPoly, currentPoly[0]]
                    let current_el = returnElementObject(tool, closedPoly, comment)
                    addElement(current_el)
                    setIsDrawing(false)
                    setCurrentPoly([])
                    setSnapGuides([])
                } else {
                    context.fillRect(newP.x - dimension/2, newP.y - dimension/2, dimension, dimension)
                    // add point to currentPoly
                    setCurrentPoly((prev) => [...prev, newP])
                }
            }
        } else if(tool === 'rect') {
            setIsDrawing(true)
            context.fillStyle = 'blue'

            let dimension = 5

            let newP = {x: event.pageX, y: event.pageY}
            const isMeshRect = comment && comment.toLowerCase().includes('mesh')
            if (currentRect.length == 0) {
                newP = isMeshRect ? snapVertexWithMeshPriority(newP) : snapVertexToGrid(newP)

                // on first point
                    // add first point to state
                    // guidelines of rect
                setCurrentRect([newP])
            } else if (currentRect.length > 0){
            // on second point
            // newP = snapVertexOrtho(newP, currentRect[0])
                // snap to grid
                newP = isMeshRect ? snapVertexWithMeshPriority(newP) : snapVertexToGrid(newP)

                let pointsArray = [currentRect[0], newP]
                // add to elements state
                let currentEl = returnElementObject(tool, pointsArray, comment) // comment from props
                addElement(currentEl)
                // set current rect to []
                setCurrentRect([])
                setSnapGuides([])
                setIsDrawing(false)
            }

            context.fillRect(newP.x - dimension/2, newP.y - dimension/2, dimension, dimension)        
        } else if (tool === 'selection') {
            const pointer = {x: event.pageX, y: event.pageY}

            // Alt+click near the previous selection anchor cycles through
            // stacked candidates without rebuilding the list. Matches
            // Figma / Illustrator / Inkscape muscle memory.
            const ALT_CYCLE_TOLERANCE_PX = 4
            if (
                event.altKey &&
                candidateCycleState &&
                candidateCycleState.candidates.length > 1
            ) {
                const anchor = candidateCycleState.anchor
                const dx = pointer.x - anchor.x
                const dy = pointer.y - anchor.y
                if (Math.sqrt(dx * dx + dy * dy) <= ALT_CYCLE_TOLERANCE_PX) {
                    const nextIndex =
                        (candidateCycleState.index + 1) %
                        candidateCycleState.candidates.length
                    const picked = candidateCycleState.candidates[nextIndex]
                    setSelectedElement({
                        element: picked.element,
                        pointerDown: picked.pointerDown,
                    })
                    setCandidateCycleState({
                        ...candidateCycleState,
                        index: nextIndex,
                    })
                    event.preventDefault()
                    return
                }
            }

            const candidates = collectSelectionCandidates(pointer, elements, 40)
            if (candidates.length > 0) {
                const picked = candidates[0]
                setSelectedElement({
                    element: picked.element,
                    pointerDown: picked.pointerDown,
                })
                setCandidateCycleState({
                    anchor: pointer,
                    candidates,
                    index: 0,
                })
            } else {
                setSelectedElement(null)
                setCandidateCycleState(null)
            }
            event.preventDefault()

        } else if (tool === 'scale') {
            if (scalePoints.length < 2) {
                // if (scalePoints.length == 1) {
                    
                // }
                let prevIndex = scalePoints.length
                setIsDrawing(true) // drawing set to false on press of enter or return to origin
                let dimension = 10
                context.fillStyle = 'red'
                let newP = {x: event.pageX, y: event.pageY}
                // if ctrl pressed -> next point ortho
                if (isCtrlPressed && currentPoly.length > 0) { // and not first point
                    newP = snapVertexOrtho(newP, currentPoly[currentPoly.length-1])
                }
                newP = snapVertexToGrid(newP)
                context.fillRect(newP.x - dimension/2, newP.y - dimension/2, dimension, dimension)  
                // add point to currentPoly
                setScalePoints((prev) => [...prev, newP]) 
                // hopefully second point has registered
                if (prevIndex == 1) {
                    // action pop up
                    setShowPopup(true)
                }

            }
            // else allow to restart scale process
        }
    }
    function isRect(el) {
        if (el["type"] === 'rect') {
            return true
        }
        return false
    }
    function addOffsetToRectPoints(rectPoints, offsetX, offsetY, startingX, startingY) {
        for (let i = 0; i < rectPoints.length; i++) {
            let point = rectPoints[i]
            if (point.x == startingX && point.y == startingY) {
                // if bottom left -> change top left in x and bottom right in y
                // if top right -> change bottom right in x and top left in y
                // if top left or bottom right; change only that point
                // works when first point is top left
                let pointX = point.x + offsetX
                let pointY = point.y + offsetY
                rectPoints[i].x = pointX
                rectPoints[i].y = pointY
                rectPoints[((i-1)+4)%4].x += offsetX
                rectPoints[((i+1)+4)%4].y += offsetY
            }

        }
        return [rectPoints[0], rectPoints[2]]
    }
    function handlePointerUp(event){
        // event.preventDefault(); 
        let pointer = {x: event.pageX, y: event.pageY}
        if (selectedElement) {
            let el = selectedElement["element"] // needs id added to state
            let elementId = el["id"]
            let startingPointPosition = selectedElement["pointerDown"]
            // should be amount of times wasd clicked if this had been the case
            // let yCounter = 1
            // let xCounter = 0

            // TODO: use one cells distance
            let offsetY = 10*yCounter 
            let offsetX = 10*xCounter
            // let offsetX = pointer.x - startingPointPosition.x
            // let offsetY = pointer.y - startingPointPosition.y
            // if rect need to include corners too!
            if (isRect(el)) {
                let rectPoints = getRectCorners(el.points) // returns points in order of top left, bottom left, bottom right, top right
                for (let i = 0; i < rectPoints.length; i++) {
                    let point = rectPoints[i]
                    if (point.x == startingPointPosition.x && point.y == startingPointPosition.y) {
                        // if bottom left -> change top left in x and bottom right in y
                        // if top right -> change bottom right in x and top left in y
                        // if top left or bottom right; change only that point
                        // works when first point is top left
                        let pointX = point.x + offsetX
                        let pointY = point.y + offsetY
                        rectPoints[i].x = pointX
                        rectPoints[i].y = pointY
                        rectPoints[((i-1)+4)%4].x += offsetX
                        rectPoints[((i+1)+4)%4].y += offsetY
                    }

                }
                el.points = [rectPoints[0], rectPoints[2]]
            } else {

                for (let i = 0; i < el.points.length; i++) {
                    let point = el.points[i]
                    if (point == startingPointPosition) {
                        el.points[i].x = point.x + offsetX
                        el.points[i].y = point.y + offsetY 
                    }
                }
            }
            changeElement(el)
            setSelectedElement(null)
            setCandidateCycleState(null)
            setSnapGuides([])
            setXCounter(0)
            setYCounter(0)
        }
        // if element selected -> move from previous to new position
        // need previous pointer down point
        // apply offset to all points
        // later apply only to target point
        // should be action not moving!
        // setSelectedElement(null)
    }


  return (
  <>
    {showPopup && (
        <ScalePopup handleScaleInput={handleScaleInput} />
      )}   
    <Gridlines pixelsPerMesh={pixelsPerMesh} dimensions={dimensions} hasScale={hasScale}/>
    {/* fdrobot should be on top of everything else */}
    {/* {menuOverlay} */}
    {tool == 'scale' ? <FDRobot hintText={'Set scale: Draw two points where the distance between is known. Hold ctrl to activate ortho mode.'}/> : <>
    </>
    }
    
      <canvas 
      ref={canvasRef}
      width={canvasWidth} // pass in width and height as props
      height={canvasHeight}
      className={`border border-black rounded-md bg-transparent inset-0 absolute z-10 ${selectedElement ? 'select-none' : ''}`}
    //   className='border border-black rounded-md bg-transparent inset-0 absolute z-10'
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      />
  </>
  )
}

export default Canvas