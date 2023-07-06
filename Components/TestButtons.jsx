// import useStore from '../store/useStore'
import useStore from '@/store/useStore';
import {mockRadiationElements, mockTimeEqElements} from '../utils/mockData'
import { prepForRadiationTable } from '../utils/pointManipulation';
import TimeEquivalenceInputPopup from './TimeEquivalenceInputPopup';


const TestButtons = () => {
    const setConvertedPoints = useStore((state) => state.setConvertedPoints)
    const showTimeEqPopup = useStore((state) => state.showTimeEqPopup)
    const setShowTimeEqPopup = useStore((state) => state.setShowTimeEqPopup)

    const handleRadiation = () => {
        console.log("mockRadiationElements: ", mockRadiationElements)
        prepForRadiationTable(1.2, mockRadiationElements)
    }

    const handleTimeEq = () => {
        console.log("mockTimeEqElements: ", mockTimeEqElements)
        // convert for separate walls
        // and openings
        setConvertedPoints(mockTimeEqElements)
        setShowTimeEqPopup(true)

        // open popup

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
            Test radiation
            </button>
            <button
            onClick={handleTimeEq}
            >
            Test Time Eq
            </button>
        </>
    );
  };
  
  export default TestButtons;