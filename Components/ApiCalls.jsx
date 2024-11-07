const server_urls = {
    "localhost": 'http://127.0.0.1:8000',
    // "server": 'https://fdsbackend-1-r7337380.deta.app'
    "server": 'https://backendfornextapp-production.up.railway.app'
    
    // "server": 'https://fastapi-production-e615.up.railway.app'
    // fastapi-production-e615.up.railway.app
  }

console.log("server_urls: ", server_urls)  
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

    console.log("fetch local", server_urls.server)
    try{
      const response = await fetch(`${server_urls.server}/radiation`, {
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
  // TODO: have z, wall height, wall_thickness, stair_height (if any), px_per_m
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
      stair_enclosure_roof_z      
    } )
    console.log("bodyContent: ", bodyContent)
    const response = await fetch(`${server_urls.server}/fds`, {
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
      showMessage("Error: ",err)
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
    const response = await fetch(`${server_urls.server}/timeEq`, {
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