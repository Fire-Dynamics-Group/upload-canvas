import Image from 'next/image';
import Canvas from '../Components/Canvas'
import { useEffect, useRef, useState } from 'react'
import FDRobot from '../Components/FDRobot'

  /**Features:
   * user selects pdf image  
   * pdf added to background
   * user can draw polyline
   * gridlines arbitrary 
   * 
   * TODO: 
   * allow user to configure scale -> distance between two points
   * gridlines to be calculated from scale
   * 
   * allow mesh rectangles to be drawn
   * ctrl for ortho lines
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

export default function Home({dirs}) {
  // console.log("process.env.DEV_MODE: ", process.env.DEV_MODE)
  let dev_mode = true
  // states for uploading file
  const [uploading, setUploading] = useState(false)
  const [selectedImage, setSelectedImage] = useState("")
  const [selectedFile, setSelectedFile] = useState()
  const [ canvasDimensions, setCanvasDimensions ] = useState({})
  const pdfCanvasRef = useRef()

  const [tool, setTool] = useState("scale")

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
  const menuOverlay = (<>
<div className="fixed bottom-0 left-0 right-0 bg-gray-800 text-white" onClick={handleButtonClick} >
  <svg
    className="w-full h-12"
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
  <div className="flex justify-center py-4 relative z-30" style={{ zIndex: 100 }} >
    <button className="px-4 py-2 bg-gray-900 text-white rounded-lg">Button 1</button>
    <button className="px-4 py-2 ml-4 bg-gray-900 text-white rounded-lg">Button 2</button>
    <button className="px-4 py-2 ml-4 bg-gray-900 text-white rounded-lg">Button 3</button>
  </div>
</div>

    </>
)


  return (
    <>
      {/* TODO: have label disappear when file uploaded */}
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
      <div>
        { selectedFile ? (<>
          <Canvas tool={tool} setTool={setTool} dimensions={canvasDimensions} isDevMode={dev_mode} />
        </>
        ) : 
            <>
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

// export const getServerSideProps= async () => {
//   const props = { dirs: [] };
//   try {
//     const dirs = await fs.readdir(path.join(process.cwd(), "/public/images"));
//     props.dirs = dirs;
//     return { props };
//   } catch (error) {
//     return { props };
//   }
// }
