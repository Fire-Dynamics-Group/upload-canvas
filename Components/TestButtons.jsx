// import useStore from '../store/useStore'
import useStore from '@/store/useStore';
import {mockRadiationElements, mockTimeEqElements, mockRadAPIParams} from '../utils/mockData'
import { prepForRadiationTable } from '../utils/pointManipulation';
import TimeEquivalenceInputPopup from './TimeEquivalenceInputPopup';
import {sendTimeEqData, sendRadiationData} from './ApiCalls'


const TestButtons = () => {
    const setConvertedPoints = useStore((state) => state.setConvertedPoints)
    const showTimeEqPopup = useStore((state) => state.showTimeEqPopup)
    const setShowTimeEqPopup = useStore((state) => state.setShowTimeEqPopup)

    const handleRadiation = () => {
        // console.log("mockRadiationElements: ", mockRadiationElements)
        // prepForRadiationTable(1.2, mockRadiationElements)
        sendRadiationData(mockRadAPIParams[0], mockRadAPIParams[1], mockRadAPIParams[2], mockRadAPIParams[3], mockRadAPIParams[4], mockRadAPIParams[5], 476, 1.2, null)
    }

    const handleTimeEq = () => {
        console.log("mockTimeEqElements: ", mockTimeEqElements)
        // convert for separate walls
        // and openings
        setConvertedPoints(mockTimeEqElements)
        setShowTimeEqPopup(true)

        // open popup

    }
    const handleTimeEqAPI = () => {

        sendTimeEqData(mockTimeEqElements)
    }
    return (
        <>
            {/* <button 
            onClick={sendElementData}
            >Test API</button> */}
            {showTimeEqPopup && <TimeEquivalenceInputPopup mockData={mockTimeEqElements}/>}
            {/* <button
            onClick={handleDownload}
            >
            Test download fds file
            </button> */}
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