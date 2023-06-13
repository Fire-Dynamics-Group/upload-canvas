import Image from 'next/image';
import Canvas from '../Components/Canvas'
import { useEffect, useRef, useState } from 'react'
import FDRobot from '../Components/FDRobot'
import {CSVLink} from 'react-csv';
import useStore from '../store/useStore'


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

export default function Home({dirs}) {
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
            }}
          />
          <label htmlFor="rectangle">Stair Mesh</label>
          {/* Point  
                * if point & stair-> point for stair climb
                * if point & not stair -> fire (can be centre of box), inlet (can be polyline with two points)
          */}
          <input
            type="radio"
            id="pencil"
            checked={tool === "point"}
            onChange={() => {
              setTool("point")
              setComment("fire")
            }}
          />
          <label htmlFor="pencil">Fire</label>
    {/* </div> */}
    </>
    )
const downloadCSVButton = (
  <>
    <CSVLink data={elements ? elements: null} onClick={() => console.log("elements: ", elements)}>Download CSV</CSVLink>
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
    {downloadCSVButton}
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
          <Canvas tool={tool} setTool={setTool} dimensions={canvasDimensions} isDevMode={dev_mode} comment={comment} setComment={setComment}/>
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
