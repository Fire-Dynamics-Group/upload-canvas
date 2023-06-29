import { prepForRadiationTable } from '@/utils/pointManipulation';
import useStore from '../store/useStore'
import WalkingSpeedPopup from './WalkingSpeedPopup'
import mockRadiationElements from '@/utils/mockData'
import { useState } from 'react';

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


    // send in function actioned on click

    function handleModeButtonClick() {
        // open popup or drawer
        // allow user to change to radiation
        setShowModePopup(true)
      }
      function handleCalcButtonClick() {
        if (elements) {
          setConvertedPoints()
          setShowWalkingPopup(true) // TODO: get pop up to action
        }
        prepForRadiationTable(1.2, mockRadiationElements)
      }
      function handleWalkingInput(walkingInput) {
        // use user input
        setShowWalkingPopup(false)
        // 
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
            <> 
            {fdsGenTools}
            </>

            : <>
                {radiationTools}
            </>
          }
          {/* Point  
                * if point & stair-> point for stair climb
                * if point & not stair -> fire (can be centre of box), inlet (can be polyline with two points)
          */}
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
          <div className="text-center">
            <button 
              onClick={handleCalcButtonClick}
              className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-0.1 mr-2 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800" 
              type="button"
              >
              Run Calc
            </button>
          </div>
    </>
    );
  };
  
  export default Toolbar;