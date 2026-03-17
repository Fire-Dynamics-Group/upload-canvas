import useStore from '../store/useStore'
import { defaultDoorTimings } from '../store/useStore'
import { useState } from "react";

// @ts-ignore
const FDSInputsPopup = ({handleUserInput}) => {
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

    // Common corridor mode
    const commonCorridorMode = useStore((state) => state.commonCorridorMode)
    const setCommonCorridorMode = useStore((state) => state.setCommonCorridorMode)

    // Scenario settings (common corridor only)
    const scenarioType = useStore((state) => state.scenarioType)
    const setScenarioType = useStore((state) => state.setScenarioType)
    const simEndTime = useStore((state) => state.simEndTime)
    const setSimEndTime = useStore((state) => state.setSimEndTime)

    // Device settings
    const includeSensors = useStore((state) => state.includeSensors)
    const setIncludeSensors = useStore((state) => state.setIncludeSensors)
    const isSprinklered = useStore((state) => state.isSprinklered)
    const setIsSprinklered = useStore((state) => state.setIsSprinklered)
    const corridorSensorHeights = useStore((state) => state.corridorSensorHeights)
    const setCorridorSensorHeights = useStore((state) => state.setCorridorSensorHeights)
    const stairSensorHeights = useStore((state) => state.stairSensorHeights)
    const setStairSensorHeights = useStore((state) => state.setStairSensorHeights)

    // Door leakage settings
    const doorLeakagesEnabled = useStore((state) => state.doorLeakagesEnabled)
    const setDoorLeakagesEnabled = useStore((state) => state.setDoorLeakagesEnabled)
    const doorLeakageConfig = useStore((state) => state.doorLeakageConfig)
    const setDoorLeakageConfig = useStore((state) => state.setDoorLeakageConfig)

    // Door openings
    const doorOpenings = useStore((state) => state.doorOpenings)
    const setDoorOpenings = useStore((state) => state.setDoorOpenings)

    // Door roles & highlighting
    const doorRoles = useStore((state) => state.doorRoles)
    const setDoorRoles = useStore((state) => state.setDoorRoles)
    const setHighlightedDoorId = useStore((state) => state.setHighlightedDoorId)

    const elements = useStore((state) => state.elements)
    // @ts-ignore
    const doorElements = elements.filter(element => element.comments === 'door')

    const handleLeakageConfigChange = (doorId: string, field: string, value: any) => {
        setDoorLeakageConfig({
            ...doorLeakageConfig,
            [doorId]: {
                ...(doorLeakageConfig[doorId] || { enabled: true, sealType: "non-smoke-sealed" }),
                [field]: value
            }
        })
    }

    type TabType = 'general' | 'scenario' | 'doors' | 'devices'
    const [activeTab, setActiveTab] = useState<TabType>('general')

    const TabButton = ({ tab, label }: { tab: TabType, label: string }) => (
        <button
            className={`px-4 py-2 ${activeTab === tab
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700'} rounded-t-lg mr-2`}
            onClick={() => setActiveTab(tab)}
        >
            {label}
        </button>
    )

    const handleTimingChange = (key: string, value: string) => {
        setDoorOpenings({ ...doorOpenings, [key]: Number(value) })
    }

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

    const ScenarioInputs = () => (
        <>
            <label className="flex items-center gap-2 mb-4 cursor-pointer">
                <input
                    type="checkbox"
                    checked={commonCorridorMode}
                    onChange={(e) => setCommonCorridorMode(e.target.checked)}
                />
                <span className="text-lg font-bold">Common Corridor Mode</span>
            </label>

            {commonCorridorMode ? (
                <>
                    <h2 className="text-lg font-bold mb-4">Scenario Type</h2>
                    <div className="flex flex-col gap-2 mb-4">
                        {["FSA", "MOE", "Both"].map((type) => (
                            <label key={type} className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="scenarioType"
                                    checked={scenarioType === type}
                                    onChange={() => setScenarioType(type)}
                                />
                                <span>{type === "Both" ? "Both (MOE + FSA)" : type}</span>
                            </label>
                        ))}
                    </div>
                </>
            ) : (
                <p className="text-sm text-gray-500">Enable Common Corridor Mode for scenario-specific door controls and timings.</p>
            )}

            <h2 className="text-lg font-bold mb-2">Simulation End Time (s):</h2>
            <input
                type="number"
                className="w-full border border-gray-300 px-3 py-2 rounded-md mb-4"
                value={simEndTime}
                onChange={(e) => setSimEndTime(Number(e.target.value))}
            />
        </>
    )

    const TimingInput = ({ label, timingKey }: { label: string, timingKey: string }) => (
        <div className="flex items-center gap-2 mb-2">
            <label className="min-w-[180px] text-sm">{label}</label>
            <input
                type="number"
                className="w-full border border-gray-300 px-3 py-2 rounded-md"
                value={doorOpenings[timingKey] ?? ''}
                onChange={(e) => handleTimingChange(timingKey, e.target.value)}
            />
            <span className="text-sm text-gray-500">s</span>
        </div>
    )

    const DoorInputs = () => (
        <>
            {commonCorridorMode && scenarioType && (
                <>
                    <h2 className="text-lg font-bold mb-2">Door Timings ({scenarioType})</h2>
                    <p className="text-sm text-gray-500 mb-4">Defaults loaded from scenario. Edit as needed.</p>

                    {scenarioType === "FSA" && (
                        <div className="mb-4">
                            <TimingInput label="Stair door open:" timingKey="stair_open" />
                            <TimingInput label="Apartment door open:" timingKey="apartment_open" />
                        </div>
                    )}

                    {scenarioType === "MOE" && (
                        <div className="mb-4">
                            <TimingInput label="Apartment door open:" timingKey="apartment_open" />
                            <TimingInput label="Apartment door close:" timingKey="apartment_close" />
                            <TimingInput label="Stair door open:" timingKey="stair_open" />
                            <TimingInput label="Stair door close:" timingKey="stair_close" />
                        </div>
                    )}

                    {scenarioType === "Both" && (
                        <div className="mb-4">
                            <h3 className="font-bold text-sm mb-2 mt-2">MOE Phase</h3>
                            <TimingInput label="Apartment door open:" timingKey="apartment_open" />
                            <TimingInput label="Apartment door close:" timingKey="apartment_close" />
                            <TimingInput label="Stair door open:" timingKey="stair_open" />
                            <TimingInput label="Stair door close:" timingKey="stair_close" />
                            <h3 className="font-bold text-sm mb-2 mt-4">FSA Phase</h3>
                            <TimingInput label="Apartment door open:" timingKey="fsa_apartment_open" />
                            <TimingInput label="Stair door open:" timingKey="fsa_stair_open" />
                        </div>
                    )}
                </>
            )}

            {/* Door assignment & settings */}
            {doorElements.length > 0 ? (
                <>
                    <h2 className="text-lg font-bold mb-2 mt-4">Door Assignment</h2>
                    <p className="text-sm text-gray-500 mb-3">Hover to highlight on canvas. Assign each door a role.</p>
                    <div className="mb-4">
                        {/* @ts-ignore */}
                        {doorElements.map((door, idx) => (
                            <div
                                key={door.id}
                                className="mb-3 border-l-4 pl-3 py-1 cursor-pointer transition-colors"
                                style={{ borderColor: doorRoles[door.id] ? '#3b82f6' : '#d1d5db' }}
                                onMouseEnter={() => setHighlightedDoorId(door.id)}
                                onMouseLeave={() => setHighlightedDoorId(null)}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-bold text-sm min-w-[60px]">Door {idx + 1}</span>
                                    <select
                                        className="border border-gray-300 px-2 py-1 rounded-md text-sm flex-1"
                                        value={doorRoles[door.id] || ''}
                                        onChange={(e) => setDoorRoles({ ...doorRoles, [door.id]: e.target.value || undefined })}
                                    >
                                        <option value="">-- Assign role --</option>
                                        <option value="apartment">Apartment Door</option>
                                        <option value="stair">Stair Door</option>
                                        <option value="lobby">Lobby Door</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>

                                {/* Leakage settings per door */}
                                <div className="ml-2 mt-1">
                                    <label className="flex items-center gap-2 mb-1">
                                        <input
                                            type="checkbox"
                                            checked={doorLeakageConfig[door.id]?.enabled !== false}
                                            onChange={(e) => handleLeakageConfigChange(door.id, 'enabled', e.target.checked)}
                                        />
                                        <span className="text-sm">Include leakage</span>
                                    </label>
                                    {doorLeakageConfig[door.id]?.enabled !== false && (
                                        <select
                                            className="border border-gray-300 px-2 py-1 rounded-md text-sm"
                                            value={doorLeakageConfig[door.id]?.sealType || 'non-smoke-sealed'}
                                            onChange={(e) => handleLeakageConfigChange(door.id, 'sealType', e.target.value)}
                                        >
                                            <option value="smoke-sealed">Smoke Sealed</option>
                                            <option value="non-smoke-sealed">Non-Smoke Sealed</option>
                                            <option value="custom">Custom</option>
                                        </select>
                                    )}
                                    {doorLeakageConfig[door.id]?.sealType === 'custom' && (
                                        <div className="mt-2 flex flex-col gap-1">
                                            <label className="text-sm">Bottom Gap (m):
                                                <input type="number" step="0.001" className="ml-2 border px-2 py-1 rounded-md w-24"
                                                    value={doorLeakageConfig[door.id]?.bottomGap || 0.01}
                                                    onChange={(e) => handleLeakageConfigChange(door.id, 'bottomGap', Number(e.target.value))}
                                                />
                                            </label>
                                            <label className="text-sm">Other Gaps (m):
                                                <input type="number" step="0.001" className="ml-2 border px-2 py-1 rounded-md w-24"
                                                    value={doorLeakageConfig[door.id]?.otherGap || 0.004}
                                                    onChange={(e) => handleLeakageConfigChange(door.id, 'otherGap', Number(e.target.value))}
                                                />
                                            </label>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={doorLeakagesEnabled}
                            onChange={(e) => setDoorLeakagesEnabled(e.target.checked)}
                        />
                        <span>Enable door leakages globally</span>
                    </label>
                </>
            ) : (
                <p className="text-sm text-gray-500 mt-4">No doors drawn yet.</p>
            )}
        </>
    )

    const DeviceInputs = () => (
        <>
            <h2 className="text-lg font-bold mb-4">Sensor Settings</h2>
            <label className="flex items-center gap-2 mb-4">
                <input
                    type="checkbox"
                    checked={includeSensors}
                    onChange={(e) => setIncludeSensors(e.target.checked)}
                />
                <span>Include sensors</span>
            </label>
            {includeSensors && (
                <>
                    <h3 className="font-bold mb-2">Corridor Sensor Heights (m above fire floor):</h3>
                    <p className="text-sm text-gray-500 mb-1">Temp, Pressure, Visibility, Velocity at each height</p>
                    <input
                        type="text"
                        className="w-full border border-gray-300 px-3 py-2 rounded-md mb-4"
                        value={corridorSensorHeights.join(', ')}
                        onChange={(e) => setCorridorSensorHeights(
                            e.target.value.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v))
                        )}
                        placeholder="e.g. 2.0"
                    />
                    <h3 className="font-bold mb-2">Stair Sensor Tree Heights (m above fire floor):</h3>
                    <p className="text-sm text-gray-500 mb-1">Temp, Visibility tree at each stair position</p>
                    <input
                        type="text"
                        className="w-full border border-gray-300 px-3 py-2 rounded-md mb-4"
                        value={stairSensorHeights.join(', ')}
                        onChange={(e) => setStairSensorHeights(
                            e.target.value.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v))
                        )}
                        placeholder="e.g. 0.5, 1.0, 1.5, 2.0"
                    />
                </>
            )}
            <h2 className="text-lg font-bold mb-4 mt-4">Sprinkler Settings</h2>
            <label className="flex items-center gap-2">
                <input
                    type="checkbox"
                    checked={isSprinklered}
                    onChange={(e) => setIsSprinklered(e.target.checked)}
                />
                <span>Include sprinklers</span>
            </label>
        </>
    )

    function handleClick() {
        let object = {
            fireFloorZ: fireFloorZ,
            fireFloorNumber: fireFloorNumber,
            stairsObject: stairsObject,
            doorOpenings: doorOpenings
        }
        handleUserInput(object)
    }

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="bg-white p-4 rounded-lg shadow-lg text-black max-h-[80vh] overflow-y-auto min-w-[400px]">
                <div className="mb-4 border-b flex flex-wrap">
                    <TabButton tab="general" label="General" />
                    <TabButton tab="scenario" label="Scenario" />
                    <TabButton tab="doors" label="Doors" />
                    <TabButton tab="devices" label="Devices" />
                </div>

                <div className="mt-4">
                    {activeTab === 'general' && <GeneralInputs />}
                    {activeTab === 'scenario' && <ScenarioInputs />}
                    {activeTab === 'doors' && <DoorInputs />}
                    {activeTab === 'devices' && <DeviceInputs />}
                </div>

                <button className="px-4 py-2 bg-blue-500 text-white rounded-lg mt-4" onClick={handleClick}>
                    Enter
                </button>
            </div>
        </div>
    );
};

export default FDSInputsPopup;
