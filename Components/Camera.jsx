import React, { useEffect, useRef, useState } from 'react';

const Camera = () => {
  const canvasRef = useRef(null);
  const [photoData, setPhotoData] = useState('');

  useEffect(() => {
    const constraints = { video: true };

    const handleSuccess = (stream) => {
      const videoTrack = stream.getVideoTracks()[0];
      const imageCapture = new ImageCapture(videoTrack);
      capturePhoto(imageCapture);
    };

    const handleError = (error) => {
      console.error('Error accessing camera:', error);
    };

    // Access the camera
    navigator.mediaDevices.getUserMedia(constraints)
      .then(handleSuccess)
      .catch(handleError);
  }, []);

  const capturePhoto = async (imageCapture) => {
    const photoBlob = await imageCapture.takePhoto();
    const photoDataUrl = URL.createObjectURL(photoBlob);
    setPhotoData(photoDataUrl);
  };

  return (
    <div>
      <button onClick={() => capturePhoto()}>Capture Photo</button>
      {photoData && (
        <div>
          <h3>Captured Photo:</h3>
          <img src={photoData} alt="Captured" />
        </div>
      )}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default Camera;
