import { useRef, useEffect } from "react";
import useStore from '../store/useStore'

const ModePopup = ({setToggleShowPopup}) => {
    const currentMode = useStore((state) => state.currentMode)
    const setCurrentMode = useStore((state) => state.setCurrentMode)
    const dialogRef = useRef(null)

    useEffect(() => {
      const dialog = dialogRef.current
      if (dialog && !dialog.open) {
        dialog.showModal()
      }
      return () => {
        if (dialog && dialog.open) {
          dialog.close()
        }
      }
    }, [])

    function handleClick() {
       setToggleShowPopup(false)
    }

    return (
      <dialog
        ref={dialogRef}
        onClose={handleClick}
        style={{ padding: 0, border: 'none', borderRadius: '0.5rem', background: 'transparent' }}
      >
        <div className="bg-white p-4 rounded-lg shadow-lg">
          <h2 className="text-lg font-bold mb-2">Choose Mode</h2>
          <input
            type="radio"
            id="fdsGen"
            name="modeSelect"
            checked={currentMode === "fdsGen"}
            onChange={() => setCurrentMode("fdsGen")}
          />
          <label htmlFor="fdsGen">FDS Generation</label>
          <input
            type="radio"
            id="radiation"
            name="modeSelect"
            checked={currentMode === "radiation"}
            onChange={() => setCurrentMode("radiation")}
          />
          <label htmlFor="radiation">Radiation</label>
          <br />
          <input
            type="radio"
            id="timeEq"
            name="modeSelect"
            checked={currentMode === "timeEq"}
            onChange={() => setCurrentMode("timeEq")}
          />
          <label htmlFor="timeEq">Time Equivalence</label>
          <br />
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded-lg mt-2"
            onClick={handleClick}
          >
            Enter
          </button>
        </div>
      </dialog>
    );
  };

  export default ModePopup;
