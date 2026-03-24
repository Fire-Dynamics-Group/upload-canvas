import useStore from '../store/useStore'

const ModePopup = ({ setToggleShowPopup, onModeSelected }) => {
    const currentMode = useStore((state) => state.currentMode)
    const setCurrentMode = useStore((state) => state.setCurrentMode)

    function handleSelect(mode) {
      setCurrentMode(mode)
      setToggleShowPopup(false)
      if (onModeSelected) onModeSelected(mode)
    }

    function handleClose() {
      setToggleShowPopup(false)
    }

    const modes = [
      { key: 'fdsGen', label: 'FDS Generation' },
      { key: 'radiation', label: 'Radiation' },
      { key: 'timeEq', label: 'Time Equivalence' },
    ]

    return (
      <div
        className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100]"
        onClick={handleClose}
      >
        <div
          className="bg-gray-800 rounded-lg p-6 w-full max-w-sm mx-4 text-white"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-lg font-medium mb-4">Choose Mode</h2>
          <div className="flex flex-col gap-2 mb-4">
            {modes.map((m) => (
              <label
                key={m.key}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors ${
                  currentMode === m.key
                    ? 'bg-blue-700 border border-blue-500'
                    : 'bg-gray-700 hover:bg-gray-600 border border-gray-600'
                }`}
              >
                <input
                  type="radio"
                  name="modeSelect"
                  checked={currentMode === m.key}
                  onChange={() => setCurrentMode(m.key)}
                  className="accent-blue-500"
                />
                {m.label}
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-3">
            <button
              className="px-4 py-2 text-gray-400 hover:text-white"
              onClick={handleClose}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg"
              onClick={() => handleSelect(currentMode)}
            >
              Enter
            </button>
          </div>
        </div>
      </div>
    );
  };

  export default ModePopup;
