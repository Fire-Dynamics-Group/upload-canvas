// import useStore from '../store/useStore'
import useStore from '@/store/useStore';
import {mockRadiationElements, mockTimeEqElements, stair_els, testElements} from '../utils/mockData'
import { prepForRadiationTable } from '../utils/pointManipulation';
import TimeEquivalenceInputPopup from './TimeEquivalenceInputPopup';
import {sendTimeEqData, sendFdsData} from './ApiCalls'


const TestButtons = () => {
    const setConvertedPoints = useStore((state) => state.setConvertedPoints)
    const showTimeEqPopup = useStore((state) => state.showTimeEqPopup)
    const setShowTimeEqPopup = useStore((state) => state.setShowTimeEqPopup)

    const handleRadiation = () => {
        // console.log("mockRadiationElements: ", mockRadiationElements)
        prepForRadiationTable(0.57, mockRadiationElements)
        // sendRadiationData(mockRadAPIParams[0], mockRadAPIParams[1], mockRadAPIParams[2], mockRadAPIParams[3], mockRadAPIParams[4], mockRadAPIParams[5], 476, 1.2, null)
    }

    const handleTimeEq = () => {
        console.log("mockTimeEqElements: ", mockTimeEqElements)
        // convert for separate walls
        // and openings
        setConvertedPoints(mockTimeEqElements)
        setShowTimeEqPopup(true)
    }
    const handleTimeEqAPI = () => {

        sendTimeEqData(mockTimeEqElements)
    }

    const handleDownload = () => {
        // need data as state
        // const fdsData = dummy_fds
        if (testElements) {
    
          const blob = new Blob([testElements], { type: "text/plain;charset=utf-8" });
          saveAs(blob, "test.fds");
        }
      }

    function handleTestFDSClick() {
    sendFdsData(stair_els)
    // send api call -> with all elements
    }

    return (
        <>
            {/* <button 
            onClick={sendElementData}
            >Test API</button> */}
            {showTimeEqPopup && <TimeEquivalenceInputPopup mockData={mockTimeEqElements}/>}
            <button
            onClick={handleDownload}
            >
            Test download fds file
            </button>
            <button
            onClick={handleTestFDSClick}
            >
            *Test FDS API!*
            </button>
            <button
            onClick={handleRadiation}
            >
            Test radiation API
            </button>
            <button
            onClick={handleTimeEq}
            >
            Test Time Eq Input
            </button>
            <button
            onClick={handleTimeEqAPI}
            >
            Test API Time Eq
            </button>
        </>
    );
  };
  
  export default TestButtons;