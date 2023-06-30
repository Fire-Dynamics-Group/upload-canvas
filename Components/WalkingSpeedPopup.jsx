import useStore from '../store/useStore'
import { useRef } from "react";

const WalkingSpeedPopup = ({handleUserInput}) => {
    const userWalkingInput = useRef()
    const userDoorInput = useRef()
    const hasDoor = useStore((state) => state.hasDoor)
    console.log("hasDoor", hasDoor)
    //  has door when one placed

    function handleClick() {
        let input = []
        let requiredLength = (hasDoor)? 2: 1
        if (userWalkingInput.current && userWalkingInput.current.value) {
            input.push(userWalkingInput.current.value)
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
          <h2 className="text-lg font-bold mb-2">Enter walking speed (m/s)</h2>
          <input ref={userWalkingInput} type="text" className="w-full border border-gray-300 px-3 py-2 rounded-md mb-4"/>
          { hasDoor && (
            <>
          <h2 className="text-lg font-bold mb-2">Enter duration to open door (s)</h2>
          <input ref={userDoorInput} type="text" className="w-full border border-gray-300 px-3 py-2 rounded-md mb-4"/>            
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