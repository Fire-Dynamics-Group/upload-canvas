import { useState } from "react";

const WallDetectionPopup = ({ onDetect, onClose, isLoading, error, pixelsPerMetre }) => {
  const [minWallThicknessMm, setMinWallThicknessMm] = useState(50);
  const [minWallLengthM, setMinWallLengthM] = useState(0.5);
  const [simplifyMm, setSimplifyMm] = useState(20);

  function handleDetect() {
    const ppm = pixelsPerMetre || 100;
    onDetect({
      minWallThickness: Math.max(1, Math.round((minWallThicknessMm / 1000) * ppm)),
      minWallLength: Math.round(minWallLengthM * ppm),
      simplifyTolerance: Math.max(0.5, (simplifyMm / 1000) * ppm),
    });
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white p-4 rounded-lg shadow-lg max-w-md w-full text-gray-900">
        <h2 className="text-lg font-bold mb-4">Wall Detection Settings</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">
            Min Wall Thickness: {minWallThicknessMm} mm
          </label>
          <input
            type="range"
            min={10}
            max={500}
            step={10}
            value={minWallThicknessMm}
            onChange={(e) => setMinWallThicknessMm(Number(e.target.value))}
            className="w-full"
          />
          <p className="text-xs text-gray-500">Ignores features thinner than this (text, dimensions, fixtures)</p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">
            Min Wall Length: {minWallLengthM} m
          </label>
          <input
            type="range"
            min={0.1}
            max={5}
            step={0.1}
            value={minWallLengthM}
            onChange={(e) => setMinWallLengthM(Number(e.target.value))}
            className="w-full"
          />
          <p className="text-xs text-gray-500">Ignores wall segments shorter than this</p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">
            Simplification: {simplifyMm} mm
          </label>
          <input
            type="range"
            min={5}
            max={200}
            step={5}
            value={simplifyMm}
            onChange={(e) => setSimplifyMm(Number(e.target.value))}
            className="w-full"
          />
          <p className="text-xs text-gray-500">Higher = fewer points, cleaner outlines</p>
        </div>

        {error && (
          <div className="mb-4 p-2 bg-red-100 text-red-700 rounded text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded-lg disabled:opacity-50"
            onClick={handleDetect}
            disabled={isLoading}
          >
            {isLoading ? "Detecting..." : "Detect Walls"}
          </button>
          <button
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default WallDetectionPopup;
