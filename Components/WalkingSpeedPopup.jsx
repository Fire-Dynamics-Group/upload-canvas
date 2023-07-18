import useStore from '../store/useStore'
import { useRef, useState } from "react";

const WalkingSpeedPopup = ({handleUserInput}) => {
    const userWalkingInput = useRef()
    const userDoorInput = useRef()
    const hasDoor = useStore((state) => state.hasDoor)
    console.log("hasDoor", hasDoor)
    //  has door when one placed

    const walkingSpeedObject = [
      {"description": "Normal Visibility", "speed": 1.2},
      {"description": "Reduced Visibility", "speed": 0.3},
    ]
    const walkingSpeedDropDownContent = (walkingSpeedObject).map((item, i) => {
      return <option key={i} value={item.speed}>{item.speed}m/s - {item.description}</option>
    })
    const [ walkingDropdownSelected, setWalkingDropdownSelected ] = useState(walkingSpeedObject[0]["speed"])
    const [ isCustomWalkingSpeed, setIsCustomWalkingSpeed ] = useState(false)
    const [ walkingSpeed, setWalkingSpeed ] = useState(walkingSpeedObject[0]["speed"])
    const [ doorOpeningDuration, setDoorOpeningDuration ] = useState(11)

    function handleClick() {
        let input = []
        let requiredLength = (hasDoor)? 2: 1
        if (!isCustomWalkingSpeed || userWalkingInput.current && userWalkingInput.current.value) {
            input.push(walkingSpeed)
            if (userDoorInput.current && userDoorInput.current.value) {
              input.push(userDoorInput.current.value)

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
          <h2 className="text-lg font-bold mb-2">Enter walking speed (m/s): </h2>
          {!isCustomWalkingSpeed ? <select
              onChange={(e) => {
                setWalkingDropdownSelected(e.target.value)
                setWalkingSpeed(e.target.value)
              }}
              name='use'
              value={walkingDropdownSelected}
              >
                { walkingSpeedDropDownContent }
          </select> 
          :
            <input 
            ref={userWalkingInput} 
            type="text" 
            className="w-full border border-gray-300 px-3 py-2 rounded-md mb-4"
            value={walkingSpeed}
            onChange={(e) => {
              setWalkingSpeed(e.target.value)
            }}
            />}
          <br/>
          <label className="mb-2">{"Tick if custom walking speed: "}</label>
                        <input
                          type="checkbox"
                          id="selection"
                          defaultChecked={isCustomWalkingSpeed}
                          onChange={() => {
                              setIsCustomWalkingSpeed(!isCustomWalkingSpeed)
                          }}
                        />  

          { hasDoor && (
            <>
          <h2 className="text-lg font-bold mb-2">Enter duration to open door (s)</h2>
          <input 
          ref={userDoorInput} 
          type="text" 
          className="w-full border border-gray-300 px-3 py-2 rounded-md mb-4"
          value={doorOpeningDuration}
          onChange={(e) => {
            setDoorOpeningDuration(e.target.value)
          }}

          />            
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
  
  export default WalkingSpeedPopup;