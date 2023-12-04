import { prepForRadiationTable } from '@/utils/pointManipulation';
import useStore from '../store/useStore'
import WalkingSpeedPopup from './WalkingSpeedPopup'
import FireInputsPopup from './FireInputsPopup'
import TimeEquivalenceInputPopup from './TimeEquivalenceInputPopup'
import {sendFdsData} from './ApiCalls'

import { useState } from 'react';
import ErrorPopup from './ErrorPopup';
import { testElements } from '@/utils/mockData';

// TODO: if fds mode, don't show run calc; show create fds button
// send further elements in api call in fdsmode
const Toolbar = ({setShowModePopup}) => {
    // bring below into home i.e. index.jsx
    // TODO: change content depending on mode
    const currentMode = useStore((state) => state.currentMode)
    const tool = useStore((state) => state.tool)
    const setTool = useStore((state) => state.setTool)
    const comment = useStore((state) => state.comment)
    const setComment = useStore((state) => state.setComment)
    const setConvertedPoints = useStore((state) => state.setConvertedPoints)
    const convertedPoints = useStore((state) => state.convertedPoints)
    const elements = useStore((state) => state.elements)
    // const handleWalkingInput = useStore((state) => state.handleWalkingInput)
    // const [walkingInput, setWalkingInput] = useState(null)
    const [showWalkingPopup, setShowWalkingPopup] = useState(false)
    // const [hasDoor, setHasDoor] = useState(false)
    const setHasDoor = useStore((state) => state.setHasDoor)
    const pdfCanvasRef = useStore((state) => state.pdfCanvasRef)
    const pdfIsGreyscale = useStore((state) => state.pdfIsGreyscale)
    const pdfData = useStore((state) => state.pdfData)
    const toggleIsPdfGreyscale = useStore((state) => state.toggleIsPdfGreyscale)

    const [showFireInputsPopup, setShowFireInputsPopup] = useState(false)   
    const totalHeatFlux = useStore((state) => state.totalHeatFlux)
    const heatEndPoint = useStore((state) => state.heatEndPoint)
    // let showErrorPopup = true
    // only actioned on calc button
    const [showErrorPopup, setShowErrorPopup] = useState(false)
    // const [showTimeEqPopup, setShowTimeEqPopup] = useState(false)
    const showTimeEqPopup = useStore((state) => state.showTimeEqPopup)
    const setShowTimeEqPopup = useStore((state) => state.setShowTimeEqPopup)

    // have errors in zustand; show and setShowPopup
    let defaultErrorList = [ // send in from state
    "2 doors present, please delete one",
    "please include a fire/hob",
    "please include an escape route"
]

const [errorList, setErrorList] = useState(defaultErrorList)


    function handleModeButtonClick() {
        // open popup or drawer
        // allow user to change to radiation
        setShowModePopup(true)
      }
      function handleCalcButtonClick() {
        if (currentMode === 'fdsGen') return

        if (elements) {
          if (elements.length === 0) {
            // below for radiation mode
            // should access error object dependant on mode
            setErrorList([defaultErrorList[1], defaultErrorList[2]])
            setShowErrorPopup(true)
            return
          }
          if (currentMode === 'radiation') {
            // further errors: if no escape route etc
            // const door = elements.filter(el => el.comments === 'door') // not always required
            let doors = elements.filter(el => el.comments === 'door')
            if (doors.length > 0 && doors[doors.length-1]['points'].length > 1) {
              // check if two points 
                setHasDoor(true)
            }
            
            setConvertedPoints()
            setShowWalkingPopup(true) // TODO: get pop up to action

          } else if (currentMode === 'timeEq') {
            setConvertedPoints()

            setShowTimeEqPopup(true)
            // popup for assignment of wall materials
            // assignment for opening heights
            // cycle through -> point at each one
            // mvp have all walls and opening form lines
          }
        } else {
          setShowErrorPopup(true)
        }
      }
      function handleWalkingInput(userInput) {
        // use user input
        let doorOpeningDuration = (userInput.length > 1 ) ? userInput[1] : 11 
        console.log("handleWalkingInput", userInput[0], convertedPoints, doorOpeningDuration)

        prepForRadiationTable(userInput[0], convertedPoints, doorOpeningDuration, totalHeatFlux, heatEndPoint)
        setShowWalkingPopup(false)
        // 
      }
      function handleFireButtonClick() {
        setShowFireInputsPopup(true)
        // open modal popup
        
      }
      function handleFireInput(userInput) {
        setShowFireInputsPopup(false)
        // fire size i.e. q
        // fire 
        // 
        
      }

      function handleFDSClick() {
        sendFdsData(elements)
        // send api call -> with all elements
      }

      function handleGreyscaleButtonClick() {
        if (pdfCanvasRef.current) {
          const canvas = pdfCanvasRef.current;
          const context = canvas.getContext('2d');
          let imageData
          if (pdfIsGreyscale) {
            // apply colour image
            imageData = pdfData["coloured"]
          } else {
            // apply greyscale image
            imageData = pdfData["greyscaled"]
          }
          toggleIsPdfGreyscale(!pdfIsGreyscale)
          context.putImageData(imageData, 0, 0);
        }
      }

    const fdsGenTools = (
        <>
                {/* non stair mesh */}
                <input
                    type="radio"
                    id="mesh"
                    checked={tool === "rect" && comment=== "mesh"}
                    onChange={() => {
                    setTool("rect") 
                    setComment("mesh")
                    }}
                />
               <label htmlFor="rectangle">Mesh</label>
                {/*  stair obstructions */}
                <input type="radio" 
                id="line" 
                checked={tool === "polyline" && comment == 'stairObstruction'} 
                onChange={() => {
                setTool("polyline")
                setComment("stairObstruction")
                }} />
                <label htmlFor="line">Stair Obstruction</label>
                {/* stair mesh */}
                <input
                type="radio"
                id="mesh"
                checked={tool === "rect" && comment=== "stairMesh"}
                onChange={() => {
                    setTool("rect") 
                    setComment("stairMesh")
                }}
                />
                <label htmlFor="rectangle">Stair Mesh</label> 
                {/* stair landing */}
                <input
                type="radio"
                id="landing"
                checked={tool === "rect" && comment=== "landing"}
                onChange={() => {
                    // TODO: add landing tool/comment?
                    setTool("rect") 
                    setComment("landing")
                }}
                />
                <label htmlFor="rectangle">Stair Landing</label> 

        </>
    )

    const radiationTools = (
        <>
                {/*  escape path */}
                <input type="radio" 
                id="line" 
                checked={tool === "polyline" && comment == 'escapeRoute'} 
                onChange={() => {
                setTool("polyline")
                setComment("escapeRoute")
                }} />
                <label htmlFor="line">Escape Route</label>
        </>
    )
    return (
    <>
      {/* perhaps popup can't be located in menu bar? */}
      {showErrorPopup && <ErrorPopup setShowPopup={setShowErrorPopup} errorList={errorList}/>}
      {showTimeEqPopup && <TimeEquivalenceInputPopup mockData={null}/>}
      {showFireInputsPopup && <FireInputsPopup handleUserInput={handleFireInput}/>}
      {showWalkingPopup && <WalkingSpeedPopup handleUserInput={handleWalkingInput}/>}
        <div className="text-center">
          <button 
            onClick={handleModeButtonClick}
            className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-0.1 mr-2 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800" 
            type="button"
            >
            Change Mode
          </button>
        </div>


              {/* TODO: make overlay content dynamic depending on what mode selected  */}
    {/* 
     * obstruction, mesh, 
      * if stair -> landing, half landing, 
      * if point & stair-> point for stair climb
      * if point & not stair -> fire (can be centre of box), inlet (can be polyline with two points)  
      * doors to be lines
    */}  
   
          <input
            type="radio"
            id="selection"
            checked={tool === "selection"}
            onChange={() => {
              setTool("selection")
              setComment("")
            }}
          />
          <label htmlFor="selection">Selection</label>
          {/* non stair obstructions */}
          <input type="radio" id="line" 
          checked={tool === "polyline" && comment == 'obstruction'} 
          onChange={() => {
            setTool("polyline")
            setComment("obstruction")
            }} />
          <label htmlFor="line">Obstruction</label>

          { currentMode === 'fdsGen' ?
            fdsGenTools

            : currentMode === 'radiation' ?
                radiationTools
                : <>
                <input type="radio" id="opening" 
                checked={tool === "opening" && comment == 'opening'} 
                onChange={() => {
                  setTool("polyline")
                  setComment("opening")
                  }} />
                <label htmlFor="opening">Opening</label>
                </> 
          }
          {/* Point  
                * if point & stair-> point for stair climb
                * if point & not stair -> fire (can be centre of box), inlet (can be polyline with two points)
          */}
          {/* fire not needed for timeEq */}
          { currentMode !== 'timeEq' && <>
            <input
              type="radio"
              id="fire"
              checked={tool === "point"}
              onChange={() => {
                setTool("point")
                setComment("fire")
              }}
            />
            <label htmlFor="fire">Fire</label>

          {/* Door */}
          <input type="radio" id="line" 
            checked={tool === "polyline" && comment == 'door'} 
            onChange={() => {
              setTool("polyline") // max two points
              setComment("door")
              }} />
            <label htmlFor="line">Door</label>
            </>
          }


          <div className="text-center">
            {currentMode === 'radiation' && (<>
          <button 
              onClick={handleFireButtonClick}
              className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-0.1 mr-2 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800" 
              type="button"
              >
              Fire Inputs
            </button>
            </>
              )}
            {currentMode !== 'fdsGen' ? <>
              <button 
                onClick={handleCalcButtonClick}
                className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-0.1 mr-2 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800" 
                type="button"
                >
                Run Calc
              </button>
            </>
            :
            <>
            <button 
            onClick={handleFDSClick}
            className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-0.1 mr-2 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800" 
            type="button"
            >
            Generate FDS code
          </button>
            </>
            }
            <button 
              onClick={handleGreyscaleButtonClick}
              className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-0.1 mr-2 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800" 
              type="button"
              >
              Toggle Greyscale
            </button>
          </div>

    </>
    );
  };
  
  export default Toolbar;