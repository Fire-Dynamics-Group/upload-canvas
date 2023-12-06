import useStore from '../store/useStore'
import { useRef, useState } from "react";

// @ts-ignore
const FDSInputsPopup = ({handleUserInput}) => {
    // create object for stair stats:
    // fire floor z,
    // fire floor number 
    // find number of stairs
    // stair enclosure height
    // top storey height
    // total floors
    // allow for multiple
    // z and wall height for all stairs
    // {"index": 0, "fire_floor": 0, total_floors: 5, stair_roof_z: 25, top_storey_height: 21}

    const fireFloorZ = useStore((state) => state.fireFloorZ)
    const setFireFloorZ = useStore((state) => state.setFireFloorZ)
    const fireFloorNumber = useStore((state) => state.fireFloorNumber)
    const setFireFloorNumber = useStore((state) => state.setFireFloorNumber)
    const stairsObject = useStore((state) => state.stairsObject)
    // let fireFloorNumber = 0
    // send firefloor height with api call


    function handleClick() {
        let object = {
            fireFloorZ: fireFloorZ,
            fireFloorNumber: fireFloorNumber,
            stairsObject: stairsObject
          
          }
          handleUserInput()
        

    }



    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
        <div className="bg-white p-4 rounded-lg shadow-lg text-black">
          <h2 className="text-lg font-bold mb-2">Enter Fire Floor Height (m):</h2>
          <input 
          type="text" 
          className="w-full border border-gray-300 px-3 py-2 rounded-md mb-4" 
          value={fireFloorZ} 
          onChange={(e) => setFireFloorZ(e.target.value)}
          />  
          <h2 className="text-lg font-bold mb-2">Enter Fire Floor Number:</h2>
          <input 
          type="text" 
          className="w-full border border-gray-300 px-3 py-2 rounded-md mb-4" 
          value={fireFloorNumber} 
          onChange={(e) => setFireFloorNumber(e.target.value)}
          />  
          <button className="px-4 py-2 bg-blue-500 text-white rounded-lg" onClick={handleClick}>
            Enter
          </button>          
        </div>
      </div>
    );
  };
  
  export default FDSInputsPopup;