import { saveAs } from 'file-saver'

const server_urls = {
    "localhost": 'http://127.0.0.1:8000',
    // "server": 'https://fdsbackend-1-r7337380.deta.app'
    "server": 'https://backendfornextapp-production.up.railway.app'

    // "server": 'https://fastapi-production-e615.up.railway.app'
    // fastapi-production-e615.up.railway.app
  }

const API_BASE = process.env.NEXT_PUBLIC_API_URL || server_urls.server

console.log("server_urls: ", server_urls)

// --- Project persistence API ---

export const createProject = async (name = "Untitled Project", createdBy = null) => {
    const resp = await fetch(`${API_BASE}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, settings: {}, created_by: createdBy }),
    })
    if (!resp.ok) throw new Error(`Failed to create project: ${resp.status}`)
    return resp.json()
}

export const listProjects = async () => {
    const resp = await fetch(`${API_BASE}/projects`)
    if (!resp.ok) throw new Error(`Failed to list projects: ${resp.status}`)
    return resp.json()
}

export const loadProject = async (projectId) => {
    const resp = await fetch(`${API_BASE}/projects/${projectId}`)
    if (!resp.ok) throw new Error(`Failed to load project: ${resp.status}`)
    return resp.json()
}

export const saveProjectToServer = async (projectId, payload) => {
    const resp = await fetch(`${API_BASE}/projects/${projectId}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
    if (!resp.ok) throw new Error(`Failed to save project: ${resp.status}`)
    return resp.json()
}

export const loadFloorDetail = async (projectId, floorId) => {
    const resp = await fetch(`${API_BASE}/projects/${projectId}/floors/${floorId}`)
    if (!resp.ok) throw new Error(`Failed to load floor: ${resp.status}`)
    return resp.json()
}

export const uploadFloorPdf = async (projectId, floorId, file) => {
    const formData = new FormData()
    formData.append('file', file)
    const resp = await fetch(`${API_BASE}/projects/${projectId}/floors/${floorId}/pdf`, {
        method: 'POST',
        body: formData,
    })
    if (!resp.ok) throw new Error(`Failed to upload PDF: ${resp.status}`)
    return resp.json()
}

export const getFloorPdfUrl = async (projectId, floorId) => {
    const resp = await fetch(`${API_BASE}/projects/${projectId}/floors/${floorId}/pdf`)
    if (!resp.ok) throw new Error(`Failed to get PDF URL: ${resp.status}`)
    return resp.json()
}
export const sendRadiationData = async (
    timeArray, 
    accumulatedDistanceList, 
    hobDistanceList, 
    qList,
    timestepFEDList,
    accumulatedFEDList,
    totalHeatFlux,
    walkingSpeed,
    doorOpeningDuration,   
    docName="Oil Pan Fire Appendix.docx"
  ) => {
    
    console.log(
      timeArray, 
      accumulatedDistanceList, 
      hobDistanceList, 
      qList,
      timestepFEDList,
      accumulatedFEDList,
      totalHeatFlux,
      walkingSpeed,
      doorOpeningDuration,
      docName
    )
    // receive 
    let bodyContent = JSON.stringify( {
      timeArray, 
      accumulatedDistanceList, 
      hobDistanceList, 
      qList,
      timestepFEDList,
      accumulatedFEDList,
      totalHeatFlux,
      walkingSpeed,
      doorOpeningDuration, // need to send null if not applicable!!
      docName
    } )   

    console.log("fetch local", API_BASE)
    try{
      const response = await fetch(`${API_BASE}/radiation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: bodyContent,
      });
      try{
        const blob = await response.blob(); // get the image as a blob
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = docName;
        link.click();    
  
      } catch (err) { 
        console.error("Error: ", err);
      }

    } catch (err) { 
      console.error("Error: ", err);
    }
  }

  // TODO: make typesafe
  
//   feed in input box contents
// add
// TODO: send: missing 3 required positional arguments: 'fire_floor', 'total_floors', and 'stair_enclosure_roof_z'
export const sendFdsData = async (
  elementList,
  z=10,
  wall_height=3,
  stair_height=30,
  fire_floor=3,
  total_floors=6,
  stair_enclosure_roof_z=35,
  wall_thickness=0.2,
  px_per_m=33.6,
  scenario_type="MOE",
  sim_end_time=300,
  include_sensors=true,
  corridor_sensor_heights=[2.0],
  stair_sensor_heights=[0.5, 1.0, 1.5, 2.0],
  is_sprinklered=true,
  door_leakages_enabled=true,
  door_leakage_config={},
  door_openings={},
  door_roles={},
  landing_roles={},
  landing_up_side=null,
  stair_style="overlapping",
  obstruction_transparency={},
  aov_mode="always_open",
  aov_activation_time=null,
  extract_config={}
) => {
    console.log("elementList at api call: ", elementList)
    let bodyContent = JSON.stringify( {
      elementList,
      z,
      wall_height,
      wall_thickness,
      stair_height,
      px_per_m,
      fire_floor,
      total_floors,
      stair_enclosure_roof_z,
      scenario_type,
      sim_end_time,
      include_sensors,
      corridor_sensor_heights,
      stair_sensor_heights,
      is_sprinklered,
      door_leakages_enabled,
      door_leakage_config,
      door_openings,
      door_roles,
      landing_roles,
      landing_up_side,
      stair_style,
      obstruction_transparency,
      aov_mode,
      aov_activation_time,
      extract_config
    } )
    console.log("bodyContent: ", bodyContent)
    const response = await fetch(`${API_BASE}/fds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: bodyContent,
    });  
    try{
      const data = await response.json();
      console.log("data received: ", data)
      const blob = new Blob([data], { type: "text/plain;charset=utf-8" });
      saveAs(blob, "test.fds");
      return data;

    } catch (err) {
      console.error("Error: ",err)
    }

  }


export const sendTimeEqData = async (
    elementList,
    roomComposition=null, 
    openingHeights=null,
    isSprinklered=null,
    fireLoadDensity=null,
    compartmentHeight=null,
    tLim=null,
    fireResistancePeriod=null
    ) => {
    let convertedPoints = elementList
    let obstructions = elementList.filter(el => el.comments === 'obstruction')
    let openings = elementList.filter(el => el.comments === 'opening')
    // find number of walls
    function returnZeroArray(length, content=0) {
      let array = [] 
      for (let i=0; i<length; i++) {
          array.push(content)
      }
      return array

  }
    // to send
    // 
    if (!roomComposition) {
        roomComposition = returnZeroArray(obstructions[0]['finalPoints'].length + 2, "concrete")
    }
    if (!openingHeights) {
        openingHeights = returnZeroArray(openings.length, 1.5)
    }

    let bodyContent = [ convertedPoints, roomComposition ]

    bodyContent = JSON.stringify( {
        convertedPoints, 
        roomComposition, 
        openingHeights, 
        isSprinklered,
        fireLoadDensity,
        compartmentHeight,
        tLim,
        fireResistancePeriod
    } )
    console.log("body: ", bodyContent)
    const response = await fetch(`${API_BASE}/timeEq`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: bodyContent,
    });
    const blob = await response.blob(); // get the image as a blob
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'chart.jpeg';
    link.click();
    console.log(response.status);
    console.log(response.headers);

    return true;
  
  }

  // export const sendRadiationData = async (
  //   timeArray, 
  //   accumulatedDistanceList, 
  //   hobDistanceList, 
  //   qList,
  //   timestepFEDList,
  //   accumulatedFEDList,
  //   totalHeatFlux,
  //   walkingSpeed,
  //   doorOpeningDuration,   
  //   docName="Oil Pan Fire Appendix.docx"
  // ) => {
    
  //   console.log(
  //     timeArray, 
  //     accumulatedDistanceList, 
  //     hobDistanceList, 
  //     qList,
  //     timestepFEDList,
  //     accumulatedFEDList,
  //     totalHeatFlux,
  //     walkingSpeed,
  //     doorOpeningDuration,
  //     docName
  //   )
  //   // receive 
  //   let bodyContent = JSON.stringify( {
  //     timeArray, 
  //     accumulatedDistanceList, 
  //     hobDistanceList, 
  //     qList,
  //     timestepFEDList,
  //     accumulatedFEDList,
  //     totalHeatFlux,
  //     walkingSpeed,
  //     doorOpeningDuration, // need to send null if not applicable!!
  //     docName
  //   } )   

  //   try{
  //     console.log("fetch local", server_urls.localhost)
  //     const response = await fetch(`${server_urls.localhost}/radiation`, {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json'
  //       },
  //       body: bodyContent,
  //     });
  //     try{
  //       const blob = await response.blob(); // get the image as a blob
  //       const link = document.createElement('a');
  //       link.href = URL.createObjectURL(blob);
  //       link.download = docName;
  //       link.click();    
  
  //     } catch (err) { 
  //       showMessage("Error: ",err)
  //       console.log("host", server_urls.localhost)
  //     }

  //   } catch (err) { 
  //     showMessage("Error: ",err)
  //   }
  // }