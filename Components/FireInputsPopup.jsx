import useStore from '../store/useStore'
import { useRef, useState } from "react";

const FireInputsPopup = ({handleUserInput}) => {
    const userHeatFluxInput = useRef()
    const userHeatEndpointInput = useRef()
    const totalHeatFlux = useStore((state) => state.totalHeatFlux)
    const setTotalHeatFlux = useStore((state) => state.setTotalHeatFlux)
    const heatEndpoint = useStore((state) => state.heatEndpoint)
    const setHeatEndpoint = useStore((state) => state.setHeatEndpoint)

    //  has door when one placed
    function handleClick() {
        let input = []
        if (!isCustomFireSize || isCustomFireSize && userHeatFluxInput.current && userHeatFluxInput.current.value) {
            input.push(totalHeatFlux)
            if (userHeatEndpointInput.current && userHeatEndpointInput.current.value) {
              input.push(userHeatEndpointInput.current.value)

            }
              handleUserInput(input)
        }

    }

    

    const fireSizeObject = [
      {"description": "Chip Pan", "size": 476},
      {"description": "Chip Pan Banned", "size": 150.5},
    ]    
    const fireSizeDropDownContent = (fireSizeObject).map((item, i) => {
      return <option key={i} value={item.size}>{item.description} - {item.size}kW</option>
    })
    const [ fireSizeDropdownSelected, setFireSizeDropdownSelected ] = useState(fireSizeObject[0]["size"])
    const [ isCustomFireSize, setIsCustomFireSize ] = useState(false)

    return (
      // todo: have default values either from state or hardcoded; better state; shows current value
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
        <div className="bg-white p-4 rounded-lg shadow-lg text-black">
          <h2 className="text-lg font-bold mb-2">Enter Fire Heat Flux:</h2>

          {/* TODO: have dropdown and option for specific figure */}
          {/* only show further input if checkbox selected */}
          {/* <h2 className="text-lg font-bold mb-2">Select Fire Source:</h2> */}

                      { !isCustomFireSize ? <select
                      onChange={(e) => {
                        setFireSizeDropdownSelected(e.target.value)
                        setTotalHeatFlux(e.target.value)
                      }}
                      name='use'
                      value={fireSizeDropdownSelected}
                      >
                        { fireSizeDropDownContent }
                      </select>    
                      :
          <input ref={userHeatFluxInput} type="text" className="w-full border border-gray-300 px-3 py-2 rounded-md mb-4" value={totalHeatFlux} onChange={(e) => setTotalHeatFlux(e.target.value)}/>}
                      <label className="text-lg font-bold mb-2">{"Tick if custom heat flux: "}</label>
                        <input
                          type="checkbox"
                          id="selection"
                          defaultChecked={isCustomFireSize}
                          onChange={() => {
                              setIsCustomFireSize(!isCustomFireSize)
                          }}
                        />
          <h2 className="text-lg font-bold mb-2">Enter Heat Endpoint</h2>
          <input ref={userHeatEndpointInput} type="text" className="w-full border border-gray-300 px-3 py-2 rounded-md mb-4" value={heatEndpoint} onChange={(e) => setHeatEndpoint(e.target.value)}/>            
          <button className="px-4 py-2 bg-blue-500 text-white rounded-lg" onClick={handleClick}>
            Enter
          </button>          
        </div>
      </div>
    );
  };
  
  export default FireInputsPopup;