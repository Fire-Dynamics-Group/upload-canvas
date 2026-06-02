// Default door open/close timings per scenario. Shared by the store and the
// per-mode persistence handlers; kept in its own module so importing it never
// pulls in the store (avoids a circular import).
export const defaultDoorTimings = {
    MOE: {
        apartment_open: 60,
        apartment_close: 80,
        stair_open: 70,
        stair_close: 90,
    },
    FSA: {
        stair_open: 0,
        apartment_open: 60,
    },
    Both: {
        apartment_open: 60,
        apartment_close: 80,
        stair_open: 70,
        stair_close: 90,
        fsa_apartment_open: 400,
        fsa_stair_open: 400,
    },
}

export default defaultDoorTimings
