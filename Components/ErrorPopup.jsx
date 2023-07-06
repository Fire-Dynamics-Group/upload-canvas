import useStore from '../store/useStore'
import { useRef } from "react";

let errorListDefault = [ // send in from state
    "2 doors present, please delete one",
    "please include a fire/hob",
    "please include an escape route"
]
const ErrorPopup = ({setShowPopup, errorList=errorListDefault}) => {
    // validation should be at input boxes
    // errorList = []

    function handleClick() {
        // close popup 
        setShowPopup(false)
    }

    return (
      // todo: have default values either from state or hardcoded; better state; shows current value
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
        <div className="bg-white p-4 rounded-lg shadow-lg text-black">
        <h2 className="text-lg font-bold mb-2">Error!</h2>
            <ul>

            {errorList.map((current) => {
                return (<>
                
                <li>

                    <h2 className="text-sm font-bold mb-2">{current}</h2>
                </li>
                </>)
            }
            )}
            </ul>
          <button className="px-4 py-2 bg-blue-500 text-white rounded-lg" onClick={handleClick}>
            Enter
          </button>          
        </div>
      </div>
    );
  };
  
  export default ErrorPopup;