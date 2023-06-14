import Image from 'next/image';
import Canvas from '../Components/Canvas'
import { useEffect, useRef, useState } from 'react'
import FDRobot from '../Components/FDRobot'
import useStore from '../store/useStore'
import { saveAs } from 'file-saver';


  /**Features:
   * user selects pdf image  
   * pdf added to background
   * user can draw polyline
   * gridlines arbitrary 
   * allow user to configure scale -> distance between two points
   * gridlines to be calculated from scale
   * allow mesh rectangles to be drawn
   * ctrl for ortho lines
   * points can be drawn
   * 
   * TODO: 
   * test download of data as .fds file from frontend
   * send elements as param to fastapi
   * allow naming of elements from list or similar to differentiate
   * 
   * FUTURE: 
   * migrate state to zustand
   * perhaps allow rotation of pdf?
   * 
   * 
   */
const dummy_fds = `&OBST ID='STEP1', XB = 12.0, 13.4, 1.6, 2.16,40.0, 40.25, SURF_ID = 'Plasterboard'/
&OBST ID='STEP1', XB = 12.0, 13.4, 1.86, 2.42,40.25, 40.5, SURF_ID = 'Plasterboard'/
&OBST ID='STEP1', XB = 12.0, 13.4, 2.12, 2.68,40.5, 40.75, SURF_ID = 'Plasterboard'/
&OBST ID='STEP1', XB = 12.0, 13.4, 2.38, 2.94,40.75, 41.0, SURF_ID = 'Plasterboard'/
&OBST ID='STEP1', XB = 12.0, 13.4, 2.64, 3.2,41.0, 41.25, SURF_ID = 'Plasterboard'/
&OBST ID='STEP1', XB = 12.0, 13.4, 2.9, 3.46,41.25, 41.5, SURF_ID = 'Plasterboard'/
&OBST ID='STEP1', XB = 12.0, 13.4, 3.16, 3.72,41.5, 41.75, SURF_ID = 'Plasterboard'/
&OBST ID='STEP1', XB = 12.0, 13.4, 3.42, 3.98,41.75, 42.0, SURF_ID = 'Plasterboard'/
&OBST ID='STEP1', XB = 12.0, 13.4, 3.68, 4.24,42.0, 42.25, SURF_ID = 'Plasterboard'/
&OBST ID='STEP1', XB = 12.0, 13.4, 3.94, 4.5,42.25, 42.5, SURF_ID = 'Plasterboard'/
&OBST ID='STEP1', XB = 12.0, 13.4, 1.6, 2.16,45.0, 45.25, SURF_ID = 'Plasterboard'/
&OBST ID='STEP1', XB = 12.0, 13.4, 1.86, 2.42,45.25, 45.5, SURF_ID = 'Plasterboard'/
&OBST ID='STEP1', XB = 12.0, 13.4, 2.12, 2.68,45.5, 45.75, SURF_ID = 'Plasterboard'/
&OBST ID='STEP1', XB = 12.0, 13.4, 2.38, 2.94,45.75, 46.0, SURF_ID = 'Plasterboard'/
&OBST ID='STEP1', XB = 12.0, 13.4, 2.64, 3.2,46.0, 46.25, SURF_ID = 'Plasterboard'/
&OBST ID='STEP1', XB = 12.0, 13.4, 2.9, 3.46,46.25, 46.5, SURF_ID = 'Plasterboard'/
&OBST ID='STEP1', XB = 12.0, 13.4, 3.16, 3.72,46.5, 46.75, SURF_ID = 'Plasterboard'/
&OBST ID='STEP1', XB = 12.0, 13.4, 3.42, 3.98,46.75, 47.0, SURF_ID = 'Plasterboard'/
&OBST ID='STEP1', XB = 12.0, 13.4, 3.68, 4.24,47.0, 47.25, SURF_ID = 'Plasterboard'/
&OBST ID='STEP1', XB = 12.0, 13.4, 3.94, 4.5,47.25, 47.5, SURF_ID = 'Plasterboard'/
&OBST ID='STEP2', XB = 10.6, 12.0, 3.94, 4.5,42.5, 42.75, SURF_ID = 'Plasterboard'/
&OBST ID='STEP2', XB = 10.6, 12.0, 3.68, 4.24,42.75, 43.0, SURF_ID = 'Plasterboard'/
&OBST ID='STEP2', XB = 10.6, 12.0, 3.42, 3.98,43.0, 43.25, SURF_ID = 'Plasterboard'/
&OBST ID='STEP2', XB = 10.6, 12.0, 3.16, 3.72,43.25, 43.5, SURF_ID = 'Plasterboard'/
&OBST ID='STEP2', XB = 10.6, 12.0, 2.9, 3.46,43.5, 43.75, SURF_ID = 'Plasterboard'/
&OBST ID='STEP2', XB = 10.6, 12.0, 2.64, 3.2,43.75, 44.0, SURF_ID = 'Plasterboard'/
&OBST ID='STEP2', XB = 10.6, 12.0, 2.38, 2.94,44.0, 44.25, SURF_ID = 'Plasterboard'/
&OBST ID='STEP2', XB = 10.6, 12.0, 2.12, 2.68,44.25, 44.5, SURF_ID = 'Plasterboard'/
&OBST ID='STEP2', XB = 10.6, 12.0, 1.86, 2.42,44.5, 44.75, SURF_ID = 'Plasterboard'/
&OBST ID='STEP2', XB = 10.6, 12.0, 1.6, 2.16,44.75, 45.0, SURF_ID = 'Plasterboard'/
&OBST ID='STEP2', XB = 10.6, 12.0, 3.94, 4.5,47.5, 47.75, SURF_ID = 'Plasterboard'/
&OBST ID='STEP2', XB = 10.6, 12.0, 3.68, 4.24,47.75, 48.0, SURF_ID = 'Plasterboard'/
&OBST ID='STEP2', XB = 10.6, 12.0, 3.42, 3.98,48.0, 48.25, SURF_ID = 'Plasterboard'/
&OBST ID='STEP2', XB = 10.6, 12.0, 3.16, 3.72,48.25, 48.5, SURF_ID = 'Plasterboard'/
&OBST ID='STEP2', XB = 10.6, 12.0, 2.9, 3.46,48.5, 48.75, SURF_ID = 'Plasterboard'/
&OBST ID='STEP2', XB = 10.6, 12.0, 2.64, 3.2,48.75, 49.0, SURF_ID = 'Plasterboard'/
&OBST ID='STEP2', XB = 10.6, 12.0, 2.38, 2.94,49.0, 49.25, SURF_ID = 'Plasterboard'/
&OBST ID='STEP2', XB = 10.6, 12.0, 2.12, 2.68,49.25, 49.5, SURF_ID = 'Plasterboard'/
&OBST ID='STEP2', XB = 10.6, 12.0, 1.86, 2.42,49.5, 49.75, SURF_ID = 'Plasterboard'/
&OBST ID='STEP2', XB = 10.6, 12.0, 1.6, 2.16,49.75, 50.0, SURF_ID = 'Plasterboard'/
&OBST ID='LANDING', XB = 10.6, 13.4, 0.0, 1.6,45.0, 45.2, SURF_ID = 'Plasterboard'/
&OBST ID='ADDITIONAL LANDING', XB = 13.4, 16.2, 0.0, 1.6,45.0, 45.2, SURF_ID = 'Plasterboard'/
&OBST ID='LANDING', XB = 10.6, 13.4, 0.0, 1.6,50.0, 50.2, SURF_ID = 'Plasterboard'/
&OBST ID='ADDITIONAL LANDING', XB = 13.4, 16.2, 0.0, 1.6,50.0, 50.2, SURF_ID = 'Plasterboard'/
&OBST ID='HALF LANDING', XB = 10.6, 13.4, 4.2, 5.6000000000000005,42.5, 42.7, SURF_ID = 'Plasterboard'/
&OBST ID='HALF LANDING', XB = 10.6, 13.4, 4.2, 5.6000000000000005,47.5, 47.7, SURF_ID = 'Plasterboard'/`
// need scale also
const testElements = [
  {
    "type": "polyline",
    "points": [
        {
            "x": 234.58699702156903,
            "y": 1418.6927915113936
        },
        {
            "x": 497.1010174980868,
            "y": 1418.6927915113936
        },
        {
            "x": 497.1010174980868,
            "y": 1329.3263164555578
        },
        {
            "x": 234.58699702156903,
            "y": 1329.3263164555578
        },
        {
            "x": 234.58699702156903,
            "y": 1418.6927915113936
        }
    ],
    "comments": "obstruction"
},
{
  "type": "rect",
  "points": [
      {
          "x": 184.3183548026614,
          "y": 1156.178771034876
      },
      {
          "x": 441.24697058818936,
          "y": 1301.399293000609
      }
  ],
  "comments": "mesh"
},
{
  "type": "polyline",
  "points": [
      {
          "x": 201.0745688756306,
          "y": 932.7625833952864
      },
      {
          "x": 385.392923678292,
          "y": 932.7625833952864
      },
      {
          "x": 385.392923678292,
          "y": 1061.2268912880504
      },
      {
          "x": 201.0745688756306,
          "y": 1061.2268912880504
      },
      {
          "x": 201.0745688756306,
          "y": 932.7625833952864
      }
  ],
  "comments": "stairObstruction"
}
]

// Check if we're in the browser environment
const isBrowser = typeof window !== "undefined";

// Only import pdfjs if we're in the browser
let pdfjs;
if (isBrowser) {
  // pdfjs = require('pdfjs-dist/build/pdf');
  pdfjs = require('pdfjs-dist/webpack');

  // Set the workerSrc
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.js';
}

export default function Home() {
  // console.log("process.env.DEV_MODE: ", process.env.DEV_MODE)
  let dev_mode = true
  // states for uploading file
  const [uploading, setUploading] = useState(false)
  const [selectedImage, setSelectedImage] = useState("")
  const [selectedFile, setSelectedFile] = useState()
  const [ canvasDimensions, setCanvasDimensions ] = useState({})
  const [comment, setComment] = useState("")
  const pdfCanvasRef = useRef()

  const [tool, setTool] = useState("scale")
  const elements = useStore((state) => state.elements)

  console.log("elements log: ", elements)
  // const setElements = useStore((state) => state.setElements)

  // useEffect(() => {
  //   const sendElementData = async () => {
  //     // console.log("body: ", JSON.stringify({ elements }))
  //     const response = await fetch('http://127.0.0.1:8000/test', {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json'
  //       },
  //       body: JSON.stringify({ testElements }),
  //     });
    
  //     const data = await response.json();
  //     console.log("data received: ", data)
    
  //     return data;
    
  //   }
  //   sendElementData()
  // }, [])
  const handleFileChange = (event) => {
    const file = event.target.files[0];

    if (file && pdfCanvasRef.current) {
      const loadPdf = async () => {
        const pdfjs = await import('pdfjs-dist/build/pdf');

        const loadingTask = pdfjs.getDocument(URL.createObjectURL(file));
        loadingTask.promise.then((pdf) => {
          const pageNumber = 1;
          pdf.getPage(pageNumber).then((page) => {
            const canvas = pdfCanvasRef.current;
            const context = canvas.getContext('2d');

            const scale = 1.5;
            const viewport = page.getViewport({ scale });

            canvas.height = viewport.height;
            canvas.width = viewport.width;
            setCanvasDimensions({ width: canvas.width, height: canvas.height });

            const renderContext = {
              canvasContext: context,
              viewport: viewport,
            };
            const renderTask = page.render(renderContext);
            renderTask.promise.then(() => {
              console.log('Page rendered');
            });
            setSelectedFile(true);
          });
        });
      };

      loadPdf();
    }
  };

  const handleButtonClick = (e) => {
    e.stopPropagation();
  };

  const handleDownload = () => {
    // need data as state
    const fdsData = dummy_fds
    const blob = new Blob([fdsData], { type: "text/plain;charset=utf-8" });
    saveAs(blob, "test.fds");
  }
 


  const sendElementData = async () => {
    let elements = testElements
    let bodyContent = JSON.stringify( elements )
    console.log("body: ", bodyContent)
    const response = await fetch('http://127.0.0.1:8000/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: bodyContent,
    });
  
    const data = await response.json();
    console.log("data received: ", data)
  
    return data;
  
  }
  // const sendElementData = () => {
  //   const options = {
  //     method: 'POST',
  //     url: 'http://127.0.0.1:8000/test',
  //     headers: {
  //       'Content-Type': 'application/json',
  //     },
  //     body: JSON.stringify({ elements }),
  //   };
  
  //   return fetch(options).then((response) => {
  //     if (response.status === 200) {
  //       return response.json();
  //     } else {
  //       throw new Error(`API returned an error with status code ${response.status}`);
  //     }
  //   });
  // };

  const topButtons = (          
    <>
    {/* 
     * obstruction, mesh, 
      * if stair -> landing, half landing, 
      * if point & stair-> point for stair climb
      * if point & not stair -> fire (can be centre of box), inlet (can be polyline with two points)  
      * doors to be lines
    */}
    {/* <div className='absolute z-10 z-30'> */}
  
          {/* <input
            type="radio"
            id="selection"
            checked={tool === "selection"}
            onChange={() => setTool("selection")}
          /> */}
          {/* <label htmlFor="selection">Selection</label> */}
          {/* non stair obstructions */}
          <input type="radio" id="line" checked={tool === "polyline" && comment == 'obstruction'} onChange={() => {
            setTool("polyline")
            setComment("obstruction")
            }} />
          <label htmlFor="line">Obstruction</label>
          {/* non stair mesh */}
          <input
            type="radio"
            id="mesh"
            checked={tool === "rect" && comment=== "mesh"}
            onChange={() => {
              setTool("rect") 
              setComment("mesh")
            }}
          />
          <label htmlFor="rectangle">Mesh</label>
          {/* stair obstructions */}
          <input type="radio" id="line" checked={tool === "polyline" && comment == 'stairObstruction'} onChange={() => {
            setTool("polyline")
            setComment("stairObstruction")
            }} />
          <label htmlFor="line">Stair Obstruction</label>
          {/* stair mesh */}
          <input
            type="radio"
            id="mesh"
            checked={tool === "rect" && comment=== "stairMesh"}
            onChange={() => {
              setTool("rect") 
              setComment("stairMesh")
              sendElementData()
            }}
          />
          <label htmlFor="rectangle">Stair Mesh</label>
          {/* Point  
                * if point & stair-> point for stair climb
                * if point & not stair -> fire (can be centre of box), inlet (can be polyline with two points)
          */}
          <input
            type="radio"
            id="fire"
            checked={tool === "point"}
            onChange={() => {
              setTool("point")
              setComment("fire")
            }}
          />
          <label htmlFor="fire">Fire</label>

    {/* </div> */}
    </>
    )

  const menuOverlay = (<>
<div className="fixed bottom-0 left-0 right-0 bg-gray-800 text-white z-30 h-5vh" onClick={handleButtonClick}>
  <svg
    className="w-full h-1"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 1440 320"
    style={{ zIndex: -1 }}
  >
    <polygon
      points="0 0 1440 0 1440 120"
      className="fill-current bg-gray-900"
    />
    <polygon
      points="1440 0 0 0 0 120"
      className="fill-current bg-gray-800"
    />
  </svg>
  <div className="flex justify-center py-4 relative absolute z-30" style={{ zIndex: 100 }} >
    {topButtons}
  </div>
</div>

    </>
)



  return (
    <>
      {/* TODO: have label disappear when file uploaded */}
      {tool != "scale" ? (<>
      {menuOverlay} 
      </>
      )
      :null}
      

      <div>
        { selectedFile ? (<>
          <Canvas 
            tool={tool} 
            setTool={setTool} 
            dimensions={canvasDimensions} 
            isDevMode={dev_mode} 
            comment={comment} 
            setComment={setComment}
            />
        </>
        ) : 
            <>
      <div>
        <label>
          <input 
            id="image"
            name="image"
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
          />
        </label>
        <button 

        onClick={sendElementData}
        >Test API</button>
        <button
          onClick={handleDownload}
        >
          Test download fds file
        </button>


      </div>
              <FDRobot hintText={'Please upload PDF'} />
            </>
              
              }
        <canvas 
        ref={pdfCanvasRef}
        className='z-1'
        // onClick={sendElementData()}
        />
      </div>
    </>
)
}


