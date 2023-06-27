import { useRef } from "react";
import useStore from '../store/useStore'

const ModePopup = ({setToggleShowPopup}) => {
    const currentMode = useStore((state) => state.currentMode)
    const setCurrentMode = useStore((state) => state.setCurrentMode)

    // TODO: currentMode => zustand
    const scaleInput = useRef()
    function handleClick() {
       setToggleShowPopup(false)

    }
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
        <div className="bg-white p-4 rounded-lg shadow-lg">
          <h2 className="text-lg font-bold mb-2">Choose Mode</h2>
          {/* <input ref={scaleInput} type="text" className="w-full border border-gray-300 px-3 py-2 rounded-md mb-4" placeholder="Enter scale line length (m)" /> */}
          <input
            type="radio"
            id="fdsGen"
            checked={currentMode === "fdsGen"}
            onChange={() => {
            setCurrentMode("fdsGen")
            }}
          />
          <label htmlFor="fdsGen">FDS Generation</label>
          <input
            type="radio"
            id="radiation"
            checked={currentMode === "radiation"}
            onChange={() => {
            setCurrentMode("radiation")
            }}
          />
          <label htmlFor="radiation">Radiation</label>
          <br />
          <button className="px-4 py-2 bg-blue-500 text-white rounded-lg" onClick={handleClick}>
            Enter
          </button>          
          {/* <button className="px-4 py-2 bg-blue-500 text-white rounded-lg">
            Close
          </button> */}
        </div>
      </div>
    );
  };
  
  export default ModePopup;