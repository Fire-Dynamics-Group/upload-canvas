import Image from 'next/image';
import Canvas from '../Components/Canvas'
import { useEffect, useRef, useState } from 'react'
import FDRobot from '../Components/FDRobot'

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
   * allow naming of elements from list or similar to differentiate
   * 
   * FUTURE: 
   * migrate state to zustand
   * perhaps allow rotation of pdf?
   * 
   * 
   */

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
  const pdfCanvasRef = useRef()

  const [tool, setTool] = useState("point")

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

  const topButtons = (          
    <>
  
          {/* <input
            type="radio"
            id="selection"
            checked={tool === "selection"}
            onChange={() => setTool("selection")}
          /> */}
          {/* <label htmlFor="selection">Selection</label> */}
          <input type="radio" id="line" checked={tool === "polyline"} onChange={() => setTool("polyline")} />
          <label htmlFor="line">Polyline</label>
          <input
            type="radio"
            id="rectangle"
            checked={tool === "rect"}
            onChange={() => setTool("rect")}
          />
          <label htmlFor="rectangle">Rectangle</label>
          <input
            type="radio"
            id="pencil"
            checked={tool === "point"}
            onChange={() => setTool("point")}
          />
          <label htmlFor="pencil">Point</label>
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
      <div>
        { selectedFile ? (<>
          {menuOverlay} 
          <Canvas tool={tool} setTool={setTool} dimensions={canvasDimensions} isDevMode={dev_mode} />
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


      </div>
              <FDRobot hintText={'Please upload PDF'} />
            </>
              
              }
        <canvas 
        ref={pdfCanvasRef}
        className='z-1'
        />
      </div>
    </>
)
}

