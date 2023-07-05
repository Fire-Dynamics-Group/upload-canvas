import useStore from '../store/useStore'
import { useRef } from "react";

const FireInputsPopup = ({handleUserInput}) => {
    const userHeatFluxInput = useRef()
    const userHeatEndpointInput = useRef()
    const totalHeatFlux = useStore((state) => state.totalHeatFlux)
    const setTotalHeatFlux = useStore((state) => state.setTotalHeatFlux)
    const heatEndPoint = useStore((state) => state.heatEndPoint)
    const setHeatEndPoint = useStore((state) => state.setHeatEndPoint)

    //  has door when one placed

    function handleClick() {
        let input = []
        if (userHeatFluxInput.current && userHeatFluxInput.current.value) {
            input.push(userHeatFluxInput.current.value)
            if (userHeatEndpointInput.current && userHeatEndpointInput.current.value) {
              input.push(userHeatEndpointInput.current.value)

            }
              handleUserInput(input)
        }

    }
    return (
      // todo: have default values either from state or hardcoded; better state; shows current value
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
        <div className="bg-white p-4 rounded-lg shadow-lg text-black">
          <h2 className="text-lg font-bold mb-2">Enter Fire Heat Flux</h2>
          <input ref={userHeatFluxInput} type="text" className="w-full border border-gray-300 px-3 py-2 rounded-md mb-4" value={totalHeatFlux} onChange={(e) => setTotalHeatFlux(e.target.value)}/>
          <h2 className="text-lg font-bold mb-2">Enter Heat Endpoint</h2>
          <input ref={userHeatEndpointInput} type="text" className="w-full border border-gray-300 px-3 py-2 rounded-md mb-4" value={heatEndPoint} onChange={(e) => setHeatEndPoint(e.target.value)}/>            
          <button className="px-4 py-2 bg-blue-500 text-white rounded-lg" onClick={handleClick}>
            Enter
          </button>          
        </div>
      </div>
    );
  };
  
  export default FireInputsPopup;