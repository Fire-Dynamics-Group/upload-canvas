import { saveAs } from 'file-saver'

const server_urls = {
    "localhost": 'http://127.0.0.1:8001',
    // "server": 'https://fdsbackend-1-r7337380.deta.app'
    "server": 'https://backendfornextapp-production.up.railway.app'

    // "server": 'https://fastapi-production-e615.up.railway.app'
    // fastapi-production-e615.up.railway.app
  }

const API_BASE = process.env.NEXT_PUBLIC_API_URL || server_urls.localhost

// --- Project persistence API ---

// `mode` is the canvas mode that owns the project (fdsGen / timeEq). Each
// DB-backed mode has its own dashboard; see store/persistenceModes.js.
export const createProject = async (name = "Untitled Project", createdBy = null, mode = "fdsGen") => {
    const resp = await fetch(`${API_BASE}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mode, settings: {}, created_by: createdBy }),
    })
    if (!resp.ok) throw new Error(`Failed to create project: ${resp.status}`)
    return resp.json()
}

// Omit `mode` to list every project regardless of owning mode.
export const listProjects = async (mode = null) => {
    const query = mode ? `?mode=${encodeURIComponent(mode)}` : ''
    const resp = await fetch(`${API_BASE}/projects${query}`)
    if (!resp.ok) throw new Error(`Failed to list projects: ${resp.status}`)
    return resp.json()
}

export const loadProject = async (projectId) => {
    const resp = await fetch(`${API_BASE}/projects/${projectId}`)
    if (!resp.ok) throw new Error(`Failed to load project: ${resp.status}`)
    return resp.json()
}

export const renameProject = async (projectId, name) => {
    const resp = await fetch(`${API_BASE}/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
    })
    if (!resp.ok) throw new Error(`Failed to rename project: ${resp.status}`)
    return resp.json()
}

export const deleteProject = async (projectId) => {
    const resp = await fetch(`${API_BASE}/projects/${projectId}`, {
        method: 'DELETE',
    })
    if (!resp.ok) throw new Error(`Failed to delete project: ${resp.status}`)
    // 204 No Content — nothing to parse
    return true
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
  fsa_sensor_heights=[1.5],
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
  aov_type="hole",
  extract_config={},
  inlet_config={},
  zone_config={},
  fire_hrr=1000,
  fire_dimension=1.4,
  fire_height_above_floor=0.5,
  fire_base=0.0,
  fire_type="growing",
  fire_growth_rate="medium",
  fire_custom_alpha=null,
  slice_z_height=2.0,
  options={}, // { download?: boolean } — set download:false to fetch the FDS text without saving a file
) => {
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
      fsa_sensor_heights,
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
      aov_type,
      extract_config,
      inlet_config,
      zone_config,
      fire_hrr,
      fire_dimension,
      fire_height_above_floor,
      fire_base,
      fire_type,
      fire_growth_rate,
      fire_custom_alpha,
      slice_z_height
    } )
    const response = await fetch(`${API_BASE}/fds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: bodyContent,
    });  
    try{
      const data = await response.json();
      // Default behaviour downloads test.fds (the existing "Generate FDS code"
      // button). The 3D / FDS-code views pass { download: false } so they can
      // refresh the in-app preview without spamming file downloads.
      if (options.download !== false) {
        const blob = new Blob([data], { type: "text/plain;charset=utf-8" });
        saveAs(blob, "test.fds");
      }
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
    return true;

  }

// Shared body shape for the reliability endpoints (/timeEqReliability and
// /timeEqReliabilityCharts take the identical request model).
const reliabilityRequestBody = (
    convertedPoints,
    {
      occupancy,
      compartmentHeight,
      fireResistancePeriod,
      isSprinklered = false,
      nSim = 2000,
      openableWidths = null,   // per-wall openable width (party/fire walls = 0)
      roomComposition = null,  // for backend-derived b-value
      bValue = null,           // explicit b-value override (wins over roomComposition)
      sectionFactor = null,
      criticalTemp = null,
      tLimMinutes = null,      // fire growth rate (medium = 20)
      combustionFactor = 0.8,
      sprinklerFactor = 0.65,
      unprotected = false,
      seed = null,             // echo of a prior run's seed reproduces that run
    } = {}
  ) => {
    const body = {
      convertedPoints,
      occupancy,
      compartmentHeight,
      isSprinklered,
      nSim,
      openableWidths,
      roomComposition,
      bValue,
      sectionFactor,
      criticalTemp,
      tLimMinutes,
      combustionFactor,
      sprinklerFactor,
      unprotected,
      seed,
    }
    if (!unprotected) {
      body.fireResistancePeriod = fireResistancePeriod
    }
    return body
  }

const postReliabilityRequest = async (path, body, failLabel) => {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      let detail = `${failLabel} request failed: ${response.status}`
      try { detail = (await response.json()).detail || detail } catch { /* non-JSON error */ }
      throw new Error(detail)
    }
    return response.json()
  }

// Monte Carlo time-equivalence reliability. Unlike sendTimeEqData (which downloads a
// chart jpeg), this returns the parsed JSON reliability result for inline display.
// The result echoes the seed the run used, so the charts call can reproduce it.
export const sendTimeEqReliabilityData = async (convertedPoints, options = {}) =>
    postReliabilityRequest(
      '/timeEqReliability',
      reliabilityRequestBody(convertedPoints, options),
      'Reliability')

// Reliability report charts: the same run (pass the seed echoed by the
// reliability result) plus base64 PNGs — steel time-temperature spaghetti with
// the critical-temperature line, and the pass/fail scatter.
export const sendTimeEqReliabilityChartsData = async (convertedPoints, options = {}) =>
    postReliabilityRequest(
      '/timeEqReliabilityCharts',
      reliabilityRequestBody(convertedPoints, options),
      'Reliability charts')

const RELIABILITY_CHART_FILENAMES = {
    steelTempSpaghetti: 'reliability-steel-temperature',
    passFailScatter: 'reliability-pass-fail-scatter',
  }

const base64ToPngBlob = (b64) => {
    const bytes = atob(b64)
    const arr = new Uint8Array(bytes.length)
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
    return new Blob([arr], { type: 'image/png' })
  }

// Save the generated report charts as PNG files. The seed goes in the filename
// so a downloaded chart can always be traced back to the exact run it shows.
export const downloadReliabilityCharts = (charts, seed = null) => {
    const suffix = seed == null ? '' : `-seed${seed}`
    for (const [key, stem] of Object.entries(RELIABILITY_CHART_FILENAMES)) {
      if (charts?.[key]) saveAs(base64ToPngBlob(charts[key]), `${stem}${suffix}.png`)
    }
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

// --- External Fire Spread (BRE 135 enclosing-rectangle) API ---
// Ported app lives in backendForNextApp (routers/efs.py, services/efs_calculator.py).
// `elevations` is an array of { boundary_distance, height, width, has_suppression }.
export const calculateEfs = async (elevations, isCommercial = true) => {
    const resp = await fetch(`${API_BASE}/efs/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elevations, is_commercial: isCommercial }),
    })
    if (!resp.ok) {
        let detail = ''
        try { detail = (await resp.json()).detail } catch (_) { /* no JSON body */ }
        throw new Error(detail || `EFS calculation failed: ${resp.status}`)
    }
    return resp.json()
}

// Generate the BRE 135 Word report and trigger a download.
export const downloadEfsReport = async (elevations, isCommercial = true) => {
    const resp = await fetch(`${API_BASE}/efs/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elevations, is_commercial: isCommercial }),
    })
    if (!resp.ok) throw new Error(`Failed to generate EFS report: ${resp.status}`)
    const blob = await resp.blob()
    saveAs(blob, 'EFS_Report.docx')
}