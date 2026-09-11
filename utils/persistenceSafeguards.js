// Guard against a destructive autosave wiping saved geometry.
//
// POST /projects/{id}/save is a delete-then-recreate of the floor (verified
// end-to-end against the backend), so a save carrying an empty `elements` array
// deletes all previously-saved geometry for that floor. An in-memory blank is
// almost never a legitimate edit, so the autosave caller skips a save that would
// replace a non-empty saved floor with an empty one.

const floorElementCount = (payload, floorNumber) => {
    const floor = payload?.floors?.find((f) => f?.floor_number === floorNumber)
    return floor?.elements?.length ?? 0
}

// True when `payload` would replace a floor that was previously saved with
// elements by an empty floor — a transient wipe the caller should skip.
export function wouldWipeElements(payload, previousPayload) {
    const floors = payload?.floors
    if (!Array.isArray(floors) || floors.length === 0) return false
    return floors.some(
        (f) =>
            (f?.elements?.length ?? 0) === 0 &&
            floorElementCount(previousPayload, f?.floor_number) > 0
    )
}
