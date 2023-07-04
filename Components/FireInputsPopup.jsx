import useStore from '../store/useStore'
import { useRef } from "react";

const FireInputsPopup = ({handleUserInput}) => {
    const userHeatFluxInput = useRef()
    const userHeatEndpointInput = useRef()
    const hasDoor = useStore((state) => state.hasDoor)
    console.log("hasDoor", hasDoor)
    //  has door when one placed

    function handleClick() {
        let input = []
        let requiredLength = (hasDoor)? 2: 1
        if (userHeatFluxInput.current && userHeatFluxInput.current.value) {
            input.push(userHeatFluxInput.current.value)
            if (userHeatEndpointInput.current && userHeatEndpointInput.current.value) {
              input.push(userHeatEndpointInput.current.value)

            }
            if (input.length === requiredLength) {

              handleUserInput(input)
              console.log("input: ", input)
            }
        }

    }
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
        <div className="bg-white p-4 rounded-lg shadow-lg text-black">
          <h2 className="text-lg font-bold mb-2">Enter walking speed (m/s)</h2>
          <input ref={userHeatFluxInput} type="text" className="w-full border border-gray-300 px-3 py-2 rounded-md mb-4"/>
          { hasDoor && (
            <>
          <h2 className="text-lg font-bold mb-2">Enter duration to open door (s)</h2>
          <input ref={userHeatEndpointInput} type="text" className="w-full border border-gray-300 px-3 py-2 rounded-md mb-4"/>            
            </>
          )
          
          }
          <button className="px-4 py-2 bg-blue-500 text-white rounded-lg" onClick={handleClick}>
            Enter
          </button>          
        </div>
      </div>
    );
  };
  
  export default FireInputsPopup;