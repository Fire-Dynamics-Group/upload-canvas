import useStore from '../store/useStore'
import { useRef, useState } from "react";

// @ts-ignore
const FDSInputsPopup = ({handleUserInput}) => {
    // create object for stair stats:
    // fire floor z,
    // fire floor number 
    // find number of stairs
    // stair enclosure height
    // top storey height
    // total floors
    // allow for multiple
    // z and wall height for all stairs
    // {"index": 0, "fire_floor": 0, total_floors: 5, stair_roof_z: 25, top_storey_height: 21}

    const fireFloorZ = useStore((state) => state.fireFloorZ)
    const setFireFloorZ = useStore((state) => state.setFireFloorZ)
    const fireFloorNumber = useStore((state) => state.fireFloorNumber)
    const setFireFloorNumber = useStore((state) => state.setFireFloorNumber)
    const stairsObject = useStore((state) => state.stairsObject)
    const totalFloors = useStore((state) => state.totalFloors)
    const setTotalFloors = useStore((state) => state.setTotalFloors)
    const stairRoofZ = useStore((state) => state.stairRoofZ)
    const setStairRoofZ = useStore((state) => state.setStairRoofZ)
    const wallHeight = useStore((state) => state.wallHeight)
    const setWallHeight = useStore((state) => state.setWallHeight)
    const topStoreyHeight = useStore((state) => state.topStoreyHeight)
    const setTopStoreyHeight = useStore((state) => state.setTopStoreyHeight)
    // let fireFloorNumber = 0
    // send firefloor height with api call

    // New state for tracking door openings
    const [doorOpenings, setDoorOpenings] = useState<{[key: string]: string}>({})
    const elements = useStore((state) => state.elements)
    console.log(elements)
    // Filter only door elements
    // @ts-ignore
    const doorElements = elements.filter(element => element.comments === 'door')

    // Handle door opening time change
    const handleDoorOpeningChange = (doorId: string, time: string) => {
        setDoorOpenings(prev => ({
            ...prev,
            [doorId]: time
        }))
    }

    // Add state for active tab
    const [activeTab, setActiveTab] = useState<'general' | 'doors'>('general')

    const TabButton = ({ tab, label }: { tab: 'general' | 'doors', label: string }) => (
        <button
            className={`px-4 py-2 ${activeTab === tab 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700'} rounded-t-lg mr-2`}
            onClick={() => setActiveTab(tab)}
        >
            {label}
        </button>
    )

    const GeneralInputs = () => (
        <>
            <h2 className="text-lg font-bold mb-2">Enter Fire Floor Height (m):</h2>
            <input 
                type="text" 
                className="w-full border border-gray-300 px-3 py-2 rounded-md mb-4" 
                value={fireFloorZ} 
                onChange={(e) => setFireFloorZ(e.target.value)}
            />  
            <h2 className="text-lg font-bold mb-2">Wall Height (m):</h2>
            <input 
                type="text" 
                className="w-full border border-gray-300 px-3 py-2 rounded-md mb-4" 
                value={wallHeight} 
                onChange={(e) => setWallHeight(e.target.value)}
            />  
            <h2 className="text-lg font-bold mb-2">Enter Fire Floor Number:</h2>
            <input 
                type="text" 
                className="w-full border border-gray-300 px-3 py-2 rounded-md mb-4" 
                value={fireFloorNumber} 
                onChange={(e) => setFireFloorNumber(e.target.value)}
            />  
            <h2 className="text-lg font-bold mb-2">Total Number of Storeys:</h2>
            <input 
                type="text" 
                className="w-full border border-gray-300 px-3 py-2 rounded-md mb-4" 
                value={totalFloors} 
                onChange={(e) => setTotalFloors(e.target.value)}
            />  
            <h2 className="text-lg font-bold mb-2">Stair top storey height (m):</h2>
            <input 
                type="text" 
                className="w-full border border-gray-300 px-3 py-2 rounded-md mb-4" 
                value={topStoreyHeight} 
                onChange={(e) => setTopStoreyHeight(e.target.value)}
            />  
            <h2 className="text-lg font-bold mb-2">Stair roof height (m):</h2>
            <input 
                type="text" 
                className="w-full border border-gray-300 px-3 py-2 rounded-md mb-4" 
                value={stairRoofZ} 
                onChange={(e) => setStairRoofZ(e.target.value)}
            />  
        </>
    )

    const DoorInputs = () => (
        <>
            {doorElements.length > 0 ? (
                <>
                    <h2 className="text-lg font-bold mb-2">Door Opening Times</h2>
                    <div className="mb-4">
                      {/* @ts-ignore */}
                        {doorElements.map((door) => (
                            <div key={door.id} className="flex items-center gap-2 mb-2">
                                <label className="min-w-[100px]">{`Door ${door.id}:`}</label>
                                <input
                                    type="number"
                                    className="w-full border border-gray-300 px-3 py-2 rounded-md"
                                    placeholder="Opening time (s)"
                                    value={doorOpenings[door.id] || ''}
                                    onChange={(e) => handleDoorOpeningChange(door.id, e.target.value)}
                                />
                            </div>
                        ))}
                    </div>
                </>
            ) : (
                <p className="text-gray-500">No doors found in the model.</p>
            )}
        </>
    )

    function handleClick() {
        let object = {
            fireFloorZ: fireFloorZ,
            fireFloorNumber: fireFloorNumber,
            stairsObject: stairsObject,
            doorOpenings: doorOpenings  // Add door openings to the object
        }
        handleUserInput(object)
    }

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="bg-white p-4 rounded-lg shadow-lg text-black max-h-[80vh] overflow-y-auto">
                <div className="mb-4 border-b">
                    <TabButton tab="general" label="General Settings" />
                    <TabButton tab="doors" label="Door Settings" />
                </div>

                <div className="mt-4">
                    {activeTab === 'general' ? <GeneralInputs /> : <DoorInputs />}
                </div>

                <button className="px-4 py-2 bg-blue-500 text-white rounded-lg mt-4" onClick={handleClick}>
                    Enter
                </button>
            </div>
        </div>
    );
};

export default FDSInputsPopup;