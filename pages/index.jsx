import Canvas from '../Components/Canvas'
import { useEffect, useRef, useState } from 'react'

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

export default function Home() {
  // states for uploading file
  const [uploading, setUploading] = useState(false)
  const [selectedImage, setSelectedImage] = useState("")
  const [selectedFile, setSelectedFile] = useState()
  const [ canvasDimensions, setCanvasDimensions ] = useState({})
  const pdfCanvasRef = useRef()


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
          <Canvas tool={"scale"} dimensions={canvasDimensions}/>
        </>
        ) : <div> Please upload pdf </div>}
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
