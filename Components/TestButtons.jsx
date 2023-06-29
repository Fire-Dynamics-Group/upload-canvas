// import useStore from '../store/useStore'
import {mockRadiationElements} from '../utils/mockData'
import { prepForRadiationTable } from '../utils/pointManipulation';


const TestButtons = () => {

    const handleRadiation = () => {
        console.log("mockRadiationElements: ", mockRadiationElements)
        prepForRadiationTable(1.2, mockRadiationElements)
    }
    return (
        <>
            {/* <button 
            onClick={sendElementData}
            >Test API</button> */}
            {/* <button
            onClick={handleDownload}
            >
            Test download fds file
            </button> */}
            <button
            onClick={handleRadiation}
            >
            Test radiation
            </button>
        </>
    );
  };
  
  export default TestButtons;