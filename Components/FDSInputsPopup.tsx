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

    // AOV settings
    const aovMode = useStore((state) => state.aovMode)
    const setAovMode = useStore((state) => state.setAovMode)
    const aovActivationTime = useStore((state) => state.aovActivationTime)
    const setAovActivationTime = useStore((state) => state.setAovActivationTime)

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

    // Landing roles & highlighting
    const landingRoles = useStore((state) => state.landingRoles)
    const setLandingRoles = useStore((state) => state.setLandingRoles)
    const setHighlightedLandingId = useStore((state) => state.setHighlightedLandingId)
    const landingUpSide = useStore((state) => state.landingUpSide)
    const setLandingUpSide = useStore((state) => state.setLandingUpSide)
    const stairStyle = useStore((state) => state.stairStyle)
    const setStairStyle = useStore((state) => state.setStairStyle)

    // Obstruction transparency
    const obstructionTransparency = useStore((state) => state.obstructionTransparency)
    const setObstructionTransparency = useStore((state) => state.setObstructionTransparency)

    // Extract config
    const extractConfig = useStore((state) => state.extractConfig)
    const setExtractConfig = useStore((state) => state.setExtractConfig)
    const setHighlightedExtractId = useStore((state) => state.setHighlightedExtractId)

    const elements = useStore((state) => state.elements)
    // @ts-ignore
    const doorElements = elements.filter(element => element.comments === 'door')
    // @ts-ignore
    const landingElements = elements.filter(element => element.comments === 'landing')
    // @ts-ignore
    const extractElements = elements.filter(element => element.comments === 'extract')

    const handleExtractConfigChange = (extractId: string, field: string, value: any) => {
        setExtractConfig({
            ...extractConfig,
            [extractId]: {
                ...(extractConfig[extractId] || { type: "natural", flowRate: 3.0, shaftWidth: 0.9, shaftDepth: 0.9, activation: "always_open", activationTime: null }),
                [field]: value
            }
        })
    }

    const handleLeakageConfigChange = (doorId: string, field: string, value: any) => {
        setDoorLeakageConfig({
            ...doorLeakageConfig,
            [doorId]: {
                ...(doorLeakageConfig[doorId] || { enabled: true, sealType: "non-smoke-sealed" }),
                [field]: value
            }
        })
    }

    const handleTransparencyChange = (key: string, value: string) => {
        const numVal = Math.min(1, Math.max(0, parseFloat(value) || 0))
        setObstructionTransparency({ ...obstructionTransparency, [key]: numVal })
    }

    type TabType = 'general' | 'scenario' | 'doors' | 'devices' | 'stairs' | 'extracts' | 'display'
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

            <h2 className="text-lg font-bold mb-2">AOV Activation</h2>
            <div className="flex flex-col gap-2 mb-4">
                {[
                    { value: "always_open", label: "Always Open" },
                    { value: "timed", label: "Timed" },
                    { value: "sprinkler", label: "Sprinkler Detection" },
                ].map((option) => (
                    <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="radio"
                            name="aovMode"
                            value={option.value}
                            checked={aovMode === option.value}
                            onChange={(e) => setAovMode(e.target.value)}
                        />
                        <span>{option.label}</span>
                    </label>
                ))}
            </div>
            {aovMode === "timed" && (
                <>
                    <h2 className="text-lg font-bold mb-2">AOV Activation Time (s):</h2>
                    <input
                        type="number"
                        className="w-full border border-gray-300 px-3 py-2 rounded-md mb-4"
                        value={aovActivationTime ?? ""}
                        placeholder="e.g. 40"
                        onChange={(e) => setAovActivationTime(e.target.value ? parseFloat(e.target.value) : null)}
                    />
                </>
            )}
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
                                        <option value="always_open">Always Open (permanent hole)</option>
                                        <option value="leakage">Leakage Only (no hole)</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>

                                {/* Leakage settings per door (hidden for always_open) */}
                                {doorRoles[door.id] !== 'always_open' && (
                                <div className="ml-2 mt-1">
                                    {doorRoles[door.id] === 'leakage' ? (
                                        <>
                                            <p className="text-xs text-gray-500 mb-1">Leakage-only: wall stays solid, HVAC leak vents generated.</p>
                                            <select
                                                className="border border-gray-300 px-2 py-1 rounded-md text-sm"
                                                value={doorLeakageConfig[door.id]?.sealType || 'non-smoke-sealed'}
                                                onChange={(e) => handleLeakageConfigChange(door.id, 'sealType', e.target.value)}
                                            >
                                                <option value="smoke-sealed">Smoke Sealed</option>
                                                <option value="non-smoke-sealed">Non-Smoke Sealed</option>
                                                <option value="custom">Custom</option>
                                            </select>
                                        </>
                                    ) : (
                                        <>
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
                                        </>
                                    )}
                                    {(doorLeakageConfig[door.id]?.sealType === 'custom') && (doorRoles[door.id] === 'leakage' || doorLeakageConfig[door.id]?.enabled !== false) && (
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
                                )}
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

    const StairInputs = () => {
        // Compute orientation from landing centers
        const floorLanding = landingElements.find((el: any) => landingRoles[el.id] === 'floor')
        const halfLanding = landingElements.find((el: any) => landingRoles[el.id] === 'half')

        let orientation: 'horizontal' | 'vertical' | null = null
        if (floorLanding && halfLanding) {
            const floorCx = (floorLanding.points[0].x + floorLanding.points[1].x) / 2
            const floorCy = (floorLanding.points[0].y + floorLanding.points[1].y) / 2
            const halfCx = (halfLanding.points[0].x + halfLanding.points[1].x) / 2
            const halfCy = (halfLanding.points[0].y + halfLanding.points[1].y) / 2
            const dx = Math.abs(floorCx - halfCx)
            const dy = Math.abs(floorCy - halfCy)
            orientation = dx > dy ? 'horizontal' : 'vertical'
        }

        const bothAssigned = floorLanding && halfLanding

        // SVG schematic
        const svgWidth = 280
        const svgHeight = 200
        const pad = 20

        // For vertical: floor at bottom, half at top, split left/right
        // For horizontal: floor on left, half on right, split top/bottom
        const renderSchematic = () => {
            if (!orientation) return null

            const landingW = orientation === 'vertical' ? svgWidth - pad * 2 : (svgWidth - pad * 3) / 2
            const landingH = orientation === 'vertical' ? (svgHeight - pad * 3) / 2 : svgHeight - pad * 2

            let floorX: number, floorY: number, halfX: number, halfY: number

            if (orientation === 'vertical') {
                floorX = pad
                floorY = svgHeight - pad - landingH
                halfX = pad
                halfY = pad
            } else {
                floorX = pad
                floorY = pad
                halfX = svgWidth - pad - landingW
                halfY = pad
            }

            // Split labels for floor landing halves
            const halves: { key: string; x: number; y: number; w: number; h: number }[] = []
            if (orientation === 'vertical') {
                // Split left/right
                halves.push({ key: 'left', x: floorX, y: floorY, w: landingW / 2, h: landingH })
                halves.push({ key: 'right', x: floorX + landingW / 2, y: floorY, w: landingW / 2, h: landingH })
            } else {
                // Split top/bottom
                halves.push({ key: 'top', x: floorX, y: floorY, w: landingW, h: landingH / 2 })
                halves.push({ key: 'bottom', x: floorX, y: floorY + landingH / 2, w: landingW, h: landingH / 2 })
            }

            // Arrow pointing from selected half toward half landing
            const renderArrow = (half: typeof halves[0]) => {
                const cx = half.x + half.w / 2
                const cy = half.y + half.h / 2
                let dx = 0, dy = 0
                const arrowLen = 15
                if (orientation === 'vertical') {
                    dy = -arrowLen // point up toward half landing
                } else {
                    dx = arrowLen // point right toward half landing
                }
                return (
                    <g key="arrow">
                        <line x1={cx} y1={cy + 8} x2={cx + dx} y2={cy + 8 + dy}
                            stroke="white" strokeWidth={2} markerEnd="url(#arrowhead)" />
                    </g>
                )
            }

            return (
                <svg width={svgWidth} height={svgHeight} className="border rounded bg-gray-100 mt-2">
                    <defs>
                        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                            <polygon points="0 0, 8 3, 0 6" fill="white" />
                        </marker>
                    </defs>

                    {/* Half landing */}
                    <rect x={halfX} y={halfY} width={landingW} height={landingH}
                        fill="#6b7280" stroke="#374151" strokeWidth={2} rx={2} />
                    <text x={halfX + landingW / 2} y={halfY + landingH / 2} textAnchor="middle"
                        dominantBaseline="middle" fontSize={11} fill="white" fontWeight="bold">
                        Half Landing
                    </text>

                    {/* Floor landing halves */}
                    {halves.map(half => {
                        const isSelected = landingUpSide === half.key
                        return (
                            <g key={half.key}>
                                <rect x={half.x} y={half.y} width={half.w} height={half.h}
                                    fill={isSelected ? '#22c55e' : '#9ca3af'}
                                    stroke="#374151" strokeWidth={2} rx={2}
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => setLandingUpSide(half.key)}
                                />
                                <text x={half.x + half.w / 2} y={half.y + half.h / 2 - 6}
                                    textAnchor="middle" dominantBaseline="middle"
                                    fontSize={11} fill="white" fontWeight="bold">
                                    {isSelected ? 'UP' : 'DOWN'}
                                </text>
                                <text x={half.x + half.w / 2} y={half.y + half.h / 2 + 8}
                                    textAnchor="middle" dominantBaseline="middle"
                                    fontSize={9} fill="white">
                                    ({half.key})
                                </text>
                                {isSelected && renderArrow(half)}
                            </g>
                        )
                    })}

                    {/* Dashed divider on floor landing */}
                    {orientation === 'vertical' ? (
                        <line x1={floorX + landingW / 2} y1={floorY}
                            x2={floorX + landingW / 2} y2={floorY + landingH}
                            stroke="#374151" strokeWidth={1} strokeDasharray="4,3" />
                    ) : (
                        <line x1={floorX} y1={floorY + landingH / 2}
                            x2={floorX + landingW} y2={floorY + landingH / 2}
                            stroke="#374151" strokeWidth={1} strokeDasharray="4,3" />
                    )}

                    {/* Floor landing label */}
                    <text x={floorX + landingW / 2} y={orientation === 'vertical' ? floorY - 5 : svgHeight - 5}
                        textAnchor="middle" fontSize={10} fill="#374151" fontWeight="bold">
                        Floor Landing
                    </text>
                </svg>
            )
        }

        return (
            <>
                <h2 className="text-lg font-bold mb-2">Stair Landing Assignment</h2>
                {landingElements.length < 2 ? (
                    <p className="text-sm text-amber-600 mb-3">
                        Draw at least 2 landing rectangles on the canvas using the &quot;Stair Landing&quot; tool.
                    </p>
                ) : (
                    <>
                        <p className="text-sm text-gray-500 mb-3">Hover to highlight on canvas. Assign each landing a role.</p>
                        <div className="mb-4">
                            {/* @ts-ignore */}
                            {landingElements.map((landing, idx) => (
                                <div
                                    key={landing.id}
                                    className="mb-3 border-l-4 pl-3 py-1 cursor-pointer transition-colors"
                                    style={{ borderColor: landingRoles[landing.id] ? '#3b82f6' : '#d1d5db' }}
                                    onMouseEnter={() => setHighlightedLandingId(landing.id)}
                                    onMouseLeave={() => setHighlightedLandingId(null)}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold text-sm min-w-[80px]">Landing {idx + 1}</span>
                                        <select
                                            className="border border-gray-300 px-2 py-1 rounded-md text-sm flex-1"
                                            value={landingRoles[landing.id] || ''}
                                            onChange={(e) => {
                                                const newRoles = { ...landingRoles }
                                                if (e.target.value) {
                                                    newRoles[landing.id] = e.target.value
                                                } else {
                                                    delete newRoles[landing.id]
                                                }
                                                setLandingRoles(newRoles)
                                            }}
                                        >
                                            <option value="">-- Assign role --</option>
                                            <option value="floor">Floor Landing</option>
                                            <option value="half">Half Landing</option>
                                        </select>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {bothAssigned && (
                            <>
                                <h2 className="text-lg font-bold mb-2">Stair Direction</h2>
                                <p className="text-sm text-gray-500 mb-2">
                                    Click the half of the floor landing where stairs go <strong>up</strong>.
                                    Orientation: <strong>{orientation}</strong>
                                </p>
                                {renderSchematic()}
                                {landingUpSide && (
                                    <p className="text-sm text-green-600 mt-2">
                                        Stairs go up from the <strong>{landingUpSide}</strong> half of the floor landing.
                                    </p>
                                )}
                            </>
                        )}

                        <h2 className="text-lg font-bold mb-2 mt-4">Step Style</h2>
                        <select
                            className="border border-gray-300 px-3 py-2 rounded-md w-full"
                            value={stairStyle}
                            onChange={(e) => setStairStyle(e.target.value)}
                        >
                            <option value="overlapping">Overlapping (full landing width)</option>
                            <option value="individual">Individual treads</option>
                        </select>
                    </>
                )}
            </>
        )
    }

    const DisplayInputs = () => (
        <>
            <h2 className="text-lg font-bold mb-2">Obstruction Transparency</h2>
            <p className="text-sm text-gray-500 mb-4">0 = opaque, 1 = fully transparent</p>

            <div className="flex items-center gap-2 mb-3">
                <label className="min-w-[150px] text-sm font-medium">Stair Walls:</label>
                <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    className="w-24 border border-gray-300 px-3 py-2 rounded-md"
                    value={obstructionTransparency?.stairWalls ?? 0.25}
                    onChange={(e) => handleTransparencyChange('stairWalls', e.target.value)}
                />
            </div>

            <div className="flex items-center gap-2 mb-3">
                <label className="min-w-[150px] text-sm font-medium">Stair Roof:</label>
                <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    className="w-24 border border-gray-300 px-3 py-2 rounded-md"
                    value={obstructionTransparency?.stairRoof ?? 0.25}
                    onChange={(e) => handleTransparencyChange('stairRoof', e.target.value)}
                />
            </div>

            <div className="flex items-center gap-2 mb-3">
                <label className="min-w-[150px] text-sm font-medium">Fire Floor Walls:</label>
                <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    className="w-24 border border-gray-300 px-3 py-2 rounded-md"
                    value={obstructionTransparency?.fireFloorWalls ?? 0.0}
                    onChange={(e) => handleTransparencyChange('fireFloorWalls', e.target.value)}
                />
            </div>
        </>
    )

    const ExtractInputs = () => (
        <>
            {extractElements.length > 0 ? (
                <>
                    <h2 className="text-lg font-bold mb-2">Extract Configuration</h2>
                    <p className="text-sm text-gray-500 mb-3">Hover to highlight on canvas. Configure each extract shaft.</p>
                    <div className="mb-4">
                        {/* @ts-ignore */}
                        {extractElements.map((extract, idx) => {
                            const config = extractConfig[extract.id] || { type: "natural", flowRate: 3.0, shaftWidth: 0.9, shaftDepth: 0.9, activation: "always_open", activationTime: null }
                            return (
                                <div
                                    key={extract.id}
                                    className="mb-4 border-l-4 pl-3 py-1 cursor-pointer transition-colors"
                                    style={{ borderColor: '#06b6d4' }}
                                    onMouseEnter={() => setHighlightedExtractId(extract.id)}
                                    onMouseLeave={() => setHighlightedExtractId(null)}
                                >
                                    <span className="font-bold text-sm">Extract {idx + 1}</span>

                                    <div className="mt-2 flex flex-col gap-2">
                                        <label className="text-sm">Type:
                                            <select
                                                className="ml-2 border border-gray-300 px-2 py-1 rounded-md text-sm"
                                                value={config.type}
                                                onChange={(e) => handleExtractConfigChange(extract.id, 'type', e.target.value)}
                                            >
                                                <option value="natural">Natural</option>
                                                <option value="mechanical">Mechanical</option>
                                            </select>
                                        </label>

                                        {config.type === 'mechanical' && (
                                            <label className="text-sm">Flow Rate (m³/s):
                                                <input type="number" step="0.1" className="ml-2 border px-2 py-1 rounded-md w-24"
                                                    value={config.flowRate ?? 3.0}
                                                    onChange={(e) => handleExtractConfigChange(extract.id, 'flowRate', Number(e.target.value))}
                                                />
                                            </label>
                                        )}

                                        <label className="text-sm">Shaft Width (m):
                                            <input type="number" step="0.1" className="ml-2 border px-2 py-1 rounded-md w-24"
                                                value={config.shaftWidth ?? 0.9}
                                                onChange={(e) => handleExtractConfigChange(extract.id, 'shaftWidth', Number(e.target.value))}
                                            />
                                        </label>

                                        <label className="text-sm">Shaft Depth (m):
                                            <input type="number" step="0.1" className="ml-2 border px-2 py-1 rounded-md w-24"
                                                value={config.shaftDepth ?? 0.9}
                                                onChange={(e) => handleExtractConfigChange(extract.id, 'shaftDepth', Number(e.target.value))}
                                            />
                                        </label>

                                        <label className="text-sm">Opening Height (m):
                                            <input type="number" step="0.1" className="ml-2 border px-2 py-1 rounded-md w-24"
                                                value={config.openingHeight ?? 3.0}
                                                onChange={(e) => handleExtractConfigChange(extract.id, 'openingHeight', Number(e.target.value))}
                                            />
                                        </label>

                                        <label className="text-sm">Opening Base (m above floor):
                                            <input type="number" step="0.1" className="ml-2 border px-2 py-1 rounded-md w-24"
                                                value={config.openingBase ?? 0.0}
                                                onChange={(e) => handleExtractConfigChange(extract.id, 'openingBase', Number(e.target.value))}
                                            />
                                        </label>

                                        <label className="text-sm">Activation:
                                            <select
                                                className="ml-2 border border-gray-300 px-2 py-1 rounded-md text-sm"
                                                value={config.activation ?? 'always_open'}
                                                onChange={(e) => handleExtractConfigChange(extract.id, 'activation', e.target.value)}
                                            >
                                                <option value="always_open">Always Open</option>
                                                <option value="timed">Timed</option>
                                                <option value="sprinkler">Sprinkler</option>
                                            </select>
                                        </label>

                                        {config.activation === 'timed' && (
                                            <label className="text-sm">Activation Time (s):
                                                <input type="number" className="ml-2 border px-2 py-1 rounded-md w-24"
                                                    value={config.activationTime ?? ''}
                                                    placeholder="e.g. 60"
                                                    onChange={(e) => handleExtractConfigChange(extract.id, 'activationTime', e.target.value ? Number(e.target.value) : null)}
                                                />
                                            </label>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </>
            ) : (
                <p className="text-sm text-gray-500">No extract openings drawn yet. Use the Extract tool to draw one.</p>
            )}
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
                    <TabButton tab="stairs" label="Stairs" />
                    <TabButton tab="extracts" label="Extracts" />
                    <TabButton tab="display" label="Display" />
                </div>

                <div className="mt-4">
                    {activeTab === 'general' && <GeneralInputs />}
                    {activeTab === 'scenario' && <ScenarioInputs />}
                    {activeTab === 'doors' && <DoorInputs />}
                    {activeTab === 'devices' && <DeviceInputs />}
                    {activeTab === 'stairs' && <StairInputs />}
                    {activeTab === 'extracts' && <ExtractInputs />}
                    {activeTab === 'display' && <DisplayInputs />}
                </div>

                <button className="px-4 py-2 bg-blue-500 text-white rounded-lg mt-4" onClick={handleClick}>
                    Enter
                </button>
            </div>
        </div>
    );
};

export default FDSInputsPopup;
