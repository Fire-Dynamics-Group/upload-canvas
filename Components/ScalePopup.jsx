import { useRef } from "react";

const ScalePopup = ({handleScaleInput}) => {
    const scaleInput = useRef()
    function handleScale() {
        console.log("scaleInput", scaleInput.current.value, handleScaleInput)
        // handleScaleInput(scaleInput.text)
        handleScaleInput(scaleInput.current.value)

    }
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
        <div className="bg-white p-4 rounded-lg shadow-lg">
          <h2 className="text-lg font-bold mb-2">Enter Length of Line (m)</h2>
          <input ref={scaleInput} type="text" className="w-full border border-gray-300 px-3 py-2 rounded-md mb-4" placeholder="Enter scale line length (m)" />
          <button className="px-4 py-2 bg-blue-500 text-white rounded-lg" onClick={handleScale}>
            Enter
          </button>          
          {/* <button className="px-4 py-2 bg-blue-500 text-white rounded-lg">
            Close
          </button> */}
        </div>
      </div>
    );
  };
  
  export default ScalePopup;