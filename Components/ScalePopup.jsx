import { useRef } from "react";

// Length-input popup for the Scale tool. `defaultValue` pre-fills the field for
// the "Change length" re-entry flow (issue #19); `onCancel` backs out without
// committing, keeping the previously-committed scale intact (issue #17).
const ScalePopup = ({ handleScaleInput, onCancel, defaultValue, title }) => {
    const scaleInput = useRef()
    function handleScale() {
        handleScaleInput(scaleInput.current.value)
    }
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
        <div className="bg-white p-4 rounded-lg shadow-lg text-black">
          <h2 className="text-lg font-bold mb-2">{title || "Enter Length of Line (m)"}</h2>
          <input
            ref={scaleInput}
            type="text"
            defaultValue={defaultValue != null ? String(defaultValue) : undefined}
            className="w-full border border-gray-300 px-3 py-2 rounded-md mb-4"
            placeholder="Enter scale line length (m)"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleScale() }}
          />
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-blue-500 text-white rounded-lg" onClick={handleScale}>
              Enter
            </button>
            {onCancel && (
              <button className="px-4 py-2 bg-gray-200 text-black rounded-lg" onClick={onCancel}>
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  export default ScalePopup;
