import Image from 'next/image'


import fullPlanImage from '../public/plans/TD02H.jpg'
import Canvas from '../Components/Canvas'
import { useState } from 'react'

  /**  image added to background
   *   user can add square on click on top of canvas
   * 
   * TODO: allow user to upload image
   * add button -> search files
   * future either convert pdf to image or allow pdf upload
   * 
   * allow user to draw on image
   */
export default function Home() {
  // states for uploading file
  const [uploading, setuploading] = useState(false)
  const [selectedImage, setSelectedImage] = useState("")
  const [selectedFile, setSelectedFile] = useState()


  function handleButtonClick() {
    return
  }
  const buttonStyle = "text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 mr-2 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800" 
  const topButtons = ( 
          <>
            <div style={{ position: "fixed", bottom: 0, padding: 10, zIndex:40 }}>
              <button className={buttonStyle} onClick={handleButtonClick}>Choose Plan</button>
              {/* <button className={buttonStyle} >Redo</button> */}
            </div>      
          </>
  )
  return (
    <>
      <div>
        <label type="file"/>
        {topButtons}
        <div className='pointer-events-none inset-0 absolute z-0'>
          <Image 
            src={fullPlanImage}
            layout="fill"
            objectFit='contain'
            alt="Plan image"
            className= 'inset-0 absolute z-0 pointer-events-none user-drag-none'
            onDragStart={(e) => e.preventDefault()}
            onClick={(e) => e.preventDefault()}
          />
        </div>
        <Canvas />

      </div>
    </>
  )
}
