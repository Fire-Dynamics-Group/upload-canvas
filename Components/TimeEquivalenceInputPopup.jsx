import useStore from '@/store/useStore';
import { useState } from 'react';
import {sendTimeEqData} from './ApiCalls'

// TODO: add fire resitance period input
// add choice of use of building
// change several input boxes to dropdowns
// TODO: discern tLim and others from use
const TimeEquivalenceInputPopup = ({mockData=null}) => {

    let walls = [0, 1, 2, 3]
    const convertedPoints = useStore((state) => state.convertedPoints)
    // let openings = [0, 1]
    let obstructions
    let openings
    if (mockData) {
        obstructions = mockData.filter(el => el.comments === 'obstruction')
        openings = mockData.filter(el => el.comments === 'opening')
        console.log("obs openings: ",mockData, obstructions, openings, mockData)
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


    const materialList = [
        "concrete",
        "brick",
        "plasterboard"
    ]

    //  has door when one placed
    function handleClick(e) {
        console.log("wallProperties: ", wallProperties)
        console.log("mockData: ", mockData, convertedPoints)
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
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 overflow-hidden">
        <div className="bg-white p-4 rounded-lg shadow-lg text-black overflow-y-auto h-[80vh]">
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
                return (<>
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
                </>)
                
            })}
            {openingHeights.map((current, index) => {
                return (<>
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
                </>)
                
            })}
            </ul>
          <button className="px-4 py-2 bg-blue-500 text-white rounded-lg" onClick={handleClick}>
            Enter
          </button>          
        </div>
      </div>
    );
  };
  
  export default TimeEquivalenceInputPopup;