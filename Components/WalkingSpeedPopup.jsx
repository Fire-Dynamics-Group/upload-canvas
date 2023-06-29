// import useStore from '../store/useStore'
import { useRef } from "react";

const WalkingSpeedPopup = ({handleUserInput}) => {
    const userInput = useRef()

    function handleClick() {
        // // TODO: needs to be a number
        // console.log("userInput", userInput.current.value, handleUserInput)
        if (userInput.current && userInput.current.value) {
            handleUserInput(userInput.current.value)
        }

    }
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
        <div className="bg-white p-4 rounded-lg shadow-lg">
          <h2 className="text-lg font-bold mb-2">Enter walking speed (m/s)</h2>
          <input ref={userInput} type="text" className="w-full border border-gray-300 px-3 py-2 rounded-md mb-4" value={1.2}/>
          <button className="px-4 py-2 bg-blue-500 text-white rounded-lg" onClick={handleClick}>
            Enter
          </button>          
        </div>
      </div>
    );
  };
  
  export default WalkingSpeedPopup;