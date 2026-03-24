import { describe, it, expect, beforeEach } from 'vitest'
import useStore from '../store/useStore'

describe('Store: leakage door role', () => {
    beforeEach(() => {
        useStore.getState().setDoorRoles({})
        useStore.getState().setDoorLeakageConfig({})
    })

    it('can set a door role to "leakage"', () => {
        useStore.getState().setDoorRoles({ 'door-1': 'leakage' })

        expect(useStore.getState().doorRoles).toEqual({ 'door-1': 'leakage' })
    })

    it('persists "leakage" role through buildSavePayload', () => {
        useStore.getState().setDoorRoles({ 'door-1': 'leakage', 'door-2': 'apartment' })

        const payload = useStore.getState().buildSavePayload()
        const floorSettings = payload.floors[0].settings

        expect(floorSettings.doorRoles).toEqual({ 'door-1': 'leakage', 'door-2': 'apartment' })
    })

    it('restores "leakage" role through hydrateFromServer', () => {
        const project = {
            id: 'proj-1',
            name: 'Test Project',
            settings: {},
        }
        const floorDetail = {
            id: 'floor-1',
            settings: {
                doorRoles: { 'door-1': 'leakage', 'door-2': 'stair' },
                doorLeakageConfig: {
                    'door-1': { enabled: true, sealType: 'smoke-sealed' },
                },
            },
            elements: [],
        }

        useStore.getState().hydrateFromServer(project, floorDetail)

        const state = useStore.getState()
        expect(state.doorRoles['door-1']).toBe('leakage')
        expect(state.doorRoles['door-2']).toBe('stair')
        expect(state.doorLeakageConfig['door-1']).toEqual({ enabled: true, sealType: 'smoke-sealed' })
    })
})
