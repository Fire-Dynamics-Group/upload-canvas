import useStore from '@/store/useStore';
import { useState, useEffect } from 'react';
import { sendTimeEqData, sendTimeEqReliabilityData } from './ApiCalls'
import {
    OCCUPANCY_DISTRIBUTIONS,
    GROWTH_RATES,
    MATERIAL_B_VALUES,
    RELIABILITY_DEFAULTS,
    wallLengths,
} from '@/utils/teqReliabilityConstants'

// TODO: add fire resitance period input
// add choice of use of building
// change several input boxes to dropdowns
// TODO: discern tLim and others from use
const TimeEquivalenceInputPopup = ({mockData=null, onClose=null}) => {

    let walls = [0, 1, 2, 3]
    const convertedPoints = useStore((state) => state.convertedPoints)
    const setShowTimeEqPopup = useStore((state) => state.setShowTimeEqPopup)

    // Close without running the calc (Escape / backdrop / close button)
    const handleClose = onClose || (() => setShowTimeEqPopup(false))
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') handleClose()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])
    // let openings = [0, 1]
    let obstructions
    let openings
    if (mockData) {
        obstructions = mockData.filter(el => el.comments === 'obstruction')
        openings = mockData.filter(el => el.comments === 'opening')
    } else {
        obstructions = convertedPoints.filter(el => el.comments === 'obstruction')
        openings = convertedPoints.filter(el => el.comments === 'opening')        
    }// else convert elements
    // get convertedPoints
    // find obstructions -> num == len -1
    // find openings -> num == len
    // create array of len(walls); all default value; zero to start
    function returnZeroArray(length, content=0) {
        let array = [] 
        for (let i=0; i<length; i++) {
            array.push(content)
        }
        return array

    }
    const [wallProperties, setWallProperties] = useState(returnZeroArray(obstructions[0]["finalPoints"].length - 1, "concrete")) // need floor and ceiling too
    const [openingHeights, setOpeningHeights] = useState(returnZeroArray(openings.length, 1))
    const [floorAndCeilingMaterials, setFloorAndCeilingMaterials] = useState(returnZeroArray(2, "concrete"))
    // needs dropdown
    // needs option to have all same material
    // if box ticked, show only one dropdown
    // const [ fireLoadDensity, setFireLoadDensity ] = useState(511)
    // const [ tLim, setTLim ] = useState(20)
    const [ fireResistancePeriod, setFireResistancePeriod] = useState(90)
    const [ compartmentHeight, setCompartmentHeight] = useState(3.15)
    const [ isSprinklered, setIsSprinklered ] = useState(false)
    const useObject = [
        {'occupancy':'Office', 'tLim': 20, "fractile": 511},
        {'occupancy':'Hotel', 'tLim': 20, "fractile": 377}, 
        {'occupancy':'Classroom', 'tLim': 20, "fractile": 347}, 
        {'occupancy':'Library', 'tLim': 20, "fractile": 1824}, 
    ]
    const [ use, setUse] = useState(useObject[0]['occupancy'])

    // --- Monte Carlo reliability mode (added alongside the deterministic calc) ---
    const [ calcType, setCalcType ] = useState('deterministic')  // 'deterministic' | 'reliability'
    const [ mcOccupancy, setMcOccupancy ] = useState('Office')
    const [ nSim, setNSim ] = useState(RELIABILITY_DEFAULTS.nSim)
    const [ growthRate, setGrowthRate ] = useState(RELIABILITY_DEFAULTS.growthRate)
    const [ combustionFactor, setCombustionFactor ] = useState(RELIABILITY_DEFAULTS.combustionFactor)
    const [ sprinklerFactor, setSprinklerFactor ] = useState(RELIABILITY_DEFAULTS.sprinklerFactor)
    const [ sectionFactor, setSectionFactor ] = useState(RELIABILITY_DEFAULTS.sectionFactor)
    const [ criticalTemp, setCriticalTemp ] = useState(RELIABILITY_DEFAULTS.criticalTemp)
    const [ customBValue, setCustomBValue ] = useState('')  // blank => derive from materials
    const [ openableWidths, setOpenableWidths ] = useState(
        () => wallLengths(mockData || convertedPoints).map((l) => Number(l.toFixed(2)))
    )
    const [ reliabilityResult, setReliabilityResult ] = useState(null)
    const [ reliabilityError, setReliabilityError ] = useState(null)
    const [ isRunning, setIsRunning ] = useState(false)


    const materialList = [
        "concrete",
        "brick",
        "plasterboard"
    ]

    //  has door when one placed
    function handleClick(e) {
        // bring floor, wall and ceiling properties together
        let roomComposition = wallProperties
        roomComposition.unshift(floorAndCeilingMaterials[0])
        roomComposition.push(floorAndCeilingMaterials[1])
        let tempData
        if (mockData) {
            tempData = mockData
        } else {
            tempData = convertedPoints
        }
        // set tLim and fld from use of building
        let currentUse = useObject.find(obj => obj.occupancy === use)
        const { occupancy, tLim, fractile } = currentUse || {}

        let returnedData = sendTimeEqData(
            tempData, 
            roomComposition, 
            openingHeights, 
            isSprinklered, 
            fractile, 
            compartmentHeight, 
            tLim,
            fireResistancePeriod
            )
        // close popup -> send api call
        // error each cell
        // change to numbers
        // action calc

    }

    async function handleReliabilityClick() {
        setReliabilityError(null)
        setReliabilityResult(null)
        setIsRunning(true)
        try {
            const roomComposition = [floorAndCeilingMaterials[0], ...wallProperties, floorAndCeilingMaterials[1]]
            const tempData = mockData || convertedPoints
            const growth = GROWTH_RATES.find((g) => g.label === growthRate)
            const result = await sendTimeEqReliabilityData(tempData, {
                occupancy: mcOccupancy,
                compartmentHeight: Number(compartmentHeight),
                fireResistancePeriod: Number(fireResistancePeriod),
                isSprinklered,
                nSim: Number(nSim),
                openableWidths: openableWidths.map(Number),
                roomComposition,
                bValue: customBValue === '' ? null : Number(customBValue),
                sectionFactor: Number(sectionFactor),
                criticalTemp: Number(criticalTemp),
                tLimMinutes: growth ? growth.tLimMinutes : undefined,
                combustionFactor: Number(combustionFactor),
                sprinklerFactor: Number(sprinklerFactor),
            })
            setReliabilityResult(result)
        } catch (err) {
            setReliabilityError(err.message || 'Reliability calculation failed')
        } finally {
            setIsRunning(false)
        }
    }

    const useDropDownContent = (useObject).map((item, i) => {
        return <option key={i} value={item.occupancy}>{item.occupancy}</option>
      })

    const materialDropDownContent = materialList.map((item, i) => {
        return <option key={i} value={item}>{item}</option>
    })
    // TODO: join floor to start and ceiling material to end of construction list before sending
    return (
      // todo: loop through obstruction elements between vertices/points
    //   how to add to state object on click
      <div
        className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 overflow-hidden"
        onClick={handleClose}
      >
        <div className="relative bg-white p-4 rounded-lg shadow-lg text-black overflow-y-auto h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              aria-label="Close"
              className="absolute top-2 right-2 text-gray-500 hover:text-black text-xl leading-none"
              onClick={handleClose}
            >
              &times;
            </button>
            <div className="flex gap-6 mb-3 pr-6">
                <label className="flex items-center gap-1">
                    <input type="radio" name="calcType" checked={calcType === 'deterministic'} onChange={() => setCalcType('deterministic')} />
                    Deterministic
                </label>
                <label className="flex items-center gap-1">
                    <input type="radio" name="calcType" checked={calcType === 'reliability'} onChange={() => setCalcType('reliability')} />
                    Monte Carlo Reliability
                </label>
            </div>
            <ul>
                <li key={"sprinklers"}>
                <label className="text-lg font-bold mb-2">{"Tick if sprinklered: "}</label>
                <input
            type="checkbox"
            id="selection"
            defaultChecked={isSprinklered}
            onChange={() => {
                setIsSprinklered(!isSprinklered)
            }}
          />
          {/* TODO: add fire resistance period input box */}
          {/* TODO: add use dropdown */}
                    {/* <h2 className="text-lg font-bold mb-2">is sprinklered?</h2>
                    <input type="text" className="w-full border border-gray-300 px-3 py-2 rounded-md mb-4" value={isSprinklered} onChange={(e) => setIsSprinklered(e.target.value)}/> */}
                </li>
                    <h2 className="text-lg font-bold mb-2">Enter Fire Resistance Period (mins):</h2>
                    <input type="text" className="w-full border border-gray-300 px-3 py-2 rounded-md mb-4" value={fireResistancePeriod} onChange={(e) => {
                        setFireResistancePeriod(e.target.value)
                    }}/>
                <li>

                </li>
                <li>
                <h2 className="text-lg font-bold mb-2">Select Use of Space:</h2>
                      <select
                      onChange={(e) => {
                          setUse(e.target.value)
                      }}
                      name='use'
                      value={use}
                      >
                        { useDropDownContent }
                      </select>
     

                </li>
                {/* <li key={"tLim"}>
                    <h2 className="text-lg font-bold mb-2">t_lim (mins)</h2>
                    <input type="text" className="w-full border border-gray-300 px-3 py-2 rounded-md mb-4" value={tLim} onChange={(e) => setTLim(e.target.value)}/>
                </li>
                <li key={"fireLoadDensity"}>
                    <h2 className="text-lg font-bold mb-2">Select Fire Load Density (MJm-2)</h2>
                    <input type="text" className="w-full border border-gray-300 px-3 py-2 rounded-md mb-4" value={fireLoadDensity} onChange={(e) => setFireLoadDensity(e.target.value)}/>
                </li> */}
                <li key={"compartmentHeight"}>
                    <h2 className="text-lg font-bold mb-2">Enter Compartment Height (m):</h2>
                    <input type="text" className="w-full border border-gray-300 px-3 py-2 rounded-md mb-4" value={compartmentHeight} onChange={(e) => setCompartmentHeight(e.target.value)}/>
                </li>
                <li key={"floorInput"}>
                <h2 className="text-lg font-bold mb-2">Select Floor Material:</h2>
                <select
                onChange={(e) =>
                    {const temp = floorAndCeilingMaterials.map((c, i) => {
                        if (i === 0) {
                            return e.target.value
                        } else {
                            return c
                        }
                    })
                
                    setFloorAndCeilingMaterials(temp) 
                    }}
                value={floorAndCeilingMaterials[0]}
                >
                    { materialDropDownContent } 
                </select>
                {/* <input type="text" className="w-full border border-gray-300 px-3 py-2 rounded-md mb-4" value={floorAndCeilingMaterials[0]} onChange={(e) =>
                {const temp = floorAndCeilingMaterials.map((c, i) => {
                    if (i === 0) {
                        return e.target.value
                    } else {
                        return c
                    }
                })
            
                setFloorAndCeilingMaterials(temp) 
                }}/> */}
                </li>
                <li key={"ceilingInput"}>
                <h2 className="text-lg font-bold mb-2">Select Ceiling Material:</h2>
                <select 
                onChange={(e) =>
                    {const temp = floorAndCeilingMaterials.map((c, i) => {
                        if (i === 1) {
                            return e.target.value
                        } else {
                            return c
                        }
                    })
                
                    setFloorAndCeilingMaterials(temp) 
                    }}
                    value={floorAndCeilingMaterials[1]}
                >
                        { materialDropDownContent }                    
                </select>
                {/* <input type="text" className="w-full border border-gray-300 px-3 py-2 rounded-md mb-4" value={floorAndCeilingMaterials[1]} onChange={(e) =>
                {const temp = floorAndCeilingMaterials.map((c, i) => {
                    if (i === 1) {
                        return e.target.value
                    } else {
                        return c
                    }
                })
            
                setFloorAndCeilingMaterials(temp) 
                }}/> */}
                </li>
            {wallProperties.map((current, index) => {
                return (
                <li key={"wallInput"+ index}>
                    {/* plan if first or last */}
                <h2 className="text-lg font-bold mb-2">Select Wall {index + 1} Material:</h2>
                {/* <label>{`Use of space: `} */}
                        <select
                        onChange={(e) => 
                            {const temp = wallProperties.map((c, i) => {
                                if (i === index) {
                                    return e.target.value
                                } else {
                                    return c
                                }
                            })
                            setWallProperties(temp)}}
                        name='use'
                        value={wallProperties[index]}
                        >
                        { materialDropDownContent }
                        </select>
                </li>
                )

            })}
            {openingHeights.map((current, index) => {
                return (
                <li key={"opening" + index}>
                    <h2 className="text-lg font-bold mb-2">Enter Opening {index + 1} Height (m):</h2>
                    {/* set wall x property on change */}
                    <input type="text" className="w-full border border-gray-300 px-3 py-2 rounded-md mb-4" value={openingHeights[index]} onChange={(e) => 
                        {const temp = openingHeights.map((c, i) => {
                            if (i === index) {
                                return e.target.value
                            } else {
                                return c
                            }
                        })
                        setOpeningHeights(temp)}}/>

                </li>
                )

            })}
            </ul>
          {calcType === 'reliability' && (
            <div className="mt-2 border-t border-gray-300 pt-3">
              <h2 className="text-lg font-bold mb-2">Monte Carlo Reliability Options</h2>

              <label className="font-semibold">Occupancy (fire-load distribution):</label>
              <select className="w-full border border-gray-300 px-3 py-2 rounded-md mb-3" value={mcOccupancy} onChange={(e) => setMcOccupancy(e.target.value)}>
                {OCCUPANCY_DISTRIBUTIONS.map((o) => (
                  <option key={o.occupancy} value={o.occupancy}>
                    {`${o.occupancy} — ${o.type}, mean ${o.mean} MJ/m², CoV ${o.cov}`}
                  </option>
                ))}
              </select>

              <label className="font-semibold">Number of simulations (max 10000):</label>
              <input type="number" className="w-full border border-gray-300 px-3 py-2 rounded-md mb-3" value={nSim} onChange={(e) => setNSim(e.target.value)} />

              <label className="font-semibold">Fire growth rate:</label>
              <select className="w-full border border-gray-300 px-3 py-2 rounded-md mb-3" value={growthRate} onChange={(e) => setGrowthRate(e.target.value)}>
                {GROWTH_RATES.map((g) => (
                  <option key={g.label} value={g.label}>{`${g.label} (t_lim ${g.tLimMinutes} min)`}</option>
                ))}
              </select>

              <label className="font-semibold">Combustibility factor:</label>
              <input type="number" step="0.05" className="w-full border border-gray-300 px-3 py-2 rounded-md mb-3" value={combustionFactor} onChange={(e) => setCombustionFactor(e.target.value)} />

              <label className="font-semibold">Sprinkler factor (applied when sprinklered):</label>
              <input type="number" step="0.05" className="w-full border border-gray-300 px-3 py-2 rounded-md mb-3" value={sprinklerFactor} onChange={(e) => setSprinklerFactor(e.target.value)} />

              <label className="font-semibold">Section factor Ap/V (1/m):</label>
              <input type="number" className="w-full border border-gray-300 px-3 py-2 rounded-md mb-3" value={sectionFactor} onChange={(e) => setSectionFactor(e.target.value)} />

              <label className="font-semibold">Critical steel temperature (°C):</label>
              <input type="number" className="w-full border border-gray-300 px-3 py-2 rounded-md mb-3" value={criticalTemp} onChange={(e) => setCriticalTemp(e.target.value)} />

              <p className="text-sm text-gray-600">{`Material b-values (W/m²s^0.5K): concrete ${Math.round(MATERIAL_B_VALUES.concrete)}, brick ${Math.round(MATERIAL_B_VALUES.brick)}, plasterboard ${Math.round(MATERIAL_B_VALUES.plasterboard)}`}</p>
              <label className="font-semibold">Custom b-value (blank = derive from materials):</label>
              <input type="number" className="w-full border border-gray-300 px-3 py-2 rounded-md mb-3" value={customBValue} onChange={(e) => setCustomBValue(e.target.value)} />

              <label className="font-semibold">Per-wall openable width (m) — party/fire walls = 0:</label>
              {openableWidths.map((w, index) => (
                <div key={`openable-${index}`} className="flex items-center gap-2 mb-1">
                  <span className="w-16">{`Wall ${index + 1}`}</span>
                  <input type="number" className="flex-1 border border-gray-300 px-2 py-1 rounded-md" value={w} onChange={(e) => {
                    const next = openableWidths.map((c, i) => (i === index ? e.target.value : c))
                    setOpenableWidths(next)
                  }} />
                </div>
              ))}
            </div>
          )}

          {reliabilityError && <p className="text-red-600 mt-2">{reliabilityError}</p>}
          {reliabilityResult && (
            <div className="mt-3 p-3 bg-gray-100 rounded-md">
              <p className="text-xl font-bold">{`Reliability: ${reliabilityResult.reliabilityPercent}%`}</p>
              <p>{`${reliabilityResult.nFailed} of ${reliabilityResult.nSim} simulations exceeded ${reliabilityResult.criticalTemp}°C`}</p>
              <p>{`FR period ${reliabilityResult.frPeriod} min · Protection ${reliabilityResult.protectionThickness_mm} mm`}</p>
              <p>{`b-value ${Math.round(reliabilityResult.bValue)} · Section factor ${reliabilityResult.sectionFactor}`}</p>
            </div>
          )}

          {calcType === 'reliability' ? (
            <button className="px-4 py-2 bg-blue-500 text-white rounded-lg mt-2 disabled:opacity-50" onClick={handleReliabilityClick} disabled={isRunning}>
              {isRunning ? 'Running…' : 'Run Reliability'}
            </button>
          ) : (
            <button className="px-4 py-2 bg-blue-500 text-white rounded-lg" onClick={handleClick}>
              Enter
            </button>
          )}
        </div>
      </div>
    );
  };
  
  export default TimeEquivalenceInputPopup;