import Image from 'next/image';
import Canvas from '../Components/Canvas'
import { useEffect, useRef, useState } from 'react'
import FDRobot from '../Components/FDRobot'
import useStore from '../store/useStore'
import { saveAs } from 'file-saver';
import ModePopup from '../Components/ModePopup'
import Toolbar from '../Components/ToolBar'
import TestButtons from '../Components/TestButtons'


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
   * test download of data as .fds file from frontend
   * send elements as param to fastapi
   * allow naming of elements from list or similar to differentiate
   * 
   * TODO: 
   * allow edit/undo of polylines and edit size of rects etc
   * generate stairs from mock data
   * componentise areas of app for fds generation -> allow points to be located on x and y using scale for other use cases
   * 
   * FUTURE: 
   * migrate state to zustand
   * perhaps allow rotation of pdf?
   * 
   * 
   */
const server_urls = {
  "localhost": 'http://127.0.0.1:8000',
  "server": 'https://fdsbackend-1-r7337380.deta.app'
}
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
  // const [ canvasDimensions, setCanvasDimensions ] = useState({})
  const canvasDimensions = useStore((state) => state.canvasDimensions)
  const setCanvasDimensions = useStore((state) => state.setCanvasDimensions)  
  const comment = useStore((state) => state.comment)
  const setComment = useStore((state) => state.setComment)

  const [ fdsData, setFdsData] = useState("")
  const [showModePopup, setShowModePopup] = useState(true)
  const pdfCanvasRef = useRef()

  // const [tool, setTool] = useState("scale")
  const tool = useStore((state) => state.tool)
  const setTool = useStore((state) => state.setTool)

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

            const scale = 1.5; //1.5
            const viewport = page.getViewport({ scale });
            

            canvas.height = viewport.height;
            canvas.width = viewport.width;
            setCanvasDimensions({ width: canvas.width, height: canvas.height }); // needs to be page

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
    // const fdsData = dummy_fds
    if (fdsData) {

      const blob = new Blob([fdsData], { type: "text/plain;charset=utf-8" });
      saveAs(blob, "test.fds");
    }
  }
 


  const sendElementData = async () => {
    let elements = testElements
    let bodyContent = JSON.stringify( elements )
    console.log("body: ", bodyContent)
    const response = await fetch(`${server_urls.server}/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: bodyContent,
    });
  
    const data = await response.json();
    console.log("data received: ", data)
    setFdsData(data)
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
  function handleModeButtonClick() {
    // open popup or drawer
    // allow user to change to radiation
    setShowModePopup(true)
  }

  // const topButtons = (          
  //   <>
  //       <div className="text-center">
  //         <button 
  //           onClick={handleModeButtonClick}
  //           className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-0.1 mr-2 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800" 
  //           type="button"
  //           >
  //           Change Mode
  //         </button>
  //       </div>


  //             {/* TODO: make overlay content dynamic depending on what mode selected  */}
  //   {/* 
  //    * obstruction, mesh, 
  //     * if stair -> landing, half landing, 
  //     * if point & stair-> point for stair climb
  //     * if point & not stair -> fire (can be centre of box), inlet (can be polyline with two points)  
  //     * doors to be lines
  //   */}  
   


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
    {/* {topButtons} */}
    {/* may be better to have mode popup in toolbar */}
    <Toolbar setShowModePopup={setShowModePopup}/>
  </div>
</div>

    </>
)


  return (
    <>
      {/* TODO: have label disappear when file uploaded */}
      {tool != "scale" ? (<>
      {/* import Toolbar component */}
      {menuOverlay} 
      </>
      )
      :null}
      {/* TODO: move bottom menu and mode popup to toolbar */}
      {showModePopup && <ModePopup setToggleShowPopup={setShowModePopup}/>}
      <div>
        { selectedFile ? (<>
          <Canvas 
            // tool={tool} 
            // setTool={setTool} 
            dimensions={canvasDimensions} 
            isDevMode={dev_mode} 
            // comment={comment} 
            // setComment={setComment}
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
        {/* TODO: move test buttons to own component & only show if localhost? */}
        <button 

        onClick={sendElementData}
        >Test API</button>
        <button
          onClick={handleDownload}
        >
          Test download fds file
        </button>
          <TestButtons />

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


