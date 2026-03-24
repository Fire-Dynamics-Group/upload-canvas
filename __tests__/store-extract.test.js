import { describe, it, expect, beforeEach, vi } from 'vitest'
import useStore from '../store/useStore'

// resetProject calls localStorage.removeItem, stub it for Node environment
if (typeof globalThis.localStorage === 'undefined') {
    globalThis.localStorage = { removeItem: vi.fn(), getItem: vi.fn(), setItem: vi.fn() }
}

describe('Store: extract shaft config', () => {
    beforeEach(() => {
        useStore.getState().setExtractConfig({})
    })

    it('default extractConfig is {}', () => {
        useStore.getState().setExtractConfig({})
        expect(useStore.getState().extractConfig).toEqual({})
    })

    it('setExtractConfig stores per-extract config', () => {
        useStore.getState().setExtractConfig({
            'extract-1': {
                type: 'mechanical',
                flowRate: 3.0,
                shaftWidth: 0.9,
                shaftDepth: 0.9,
                activation: 'always_open',
                activationTime: null,
            },
        })

        const config = useStore.getState().extractConfig
        expect(config['extract-1'].type).toBe('mechanical')
        expect(config['extract-1'].flowRate).toBe(3.0)
        expect(config['extract-1'].shaftWidth).toBe(0.9)
        expect(config['extract-1'].shaftDepth).toBe(0.9)
        expect(config['extract-1'].activation).toBe('always_open')
        expect(config['extract-1'].activationTime).toBeNull()
    })

    it('extractConfig persists in buildSavePayload under floors[0].settings', () => {
        useStore.getState().setExtractConfig({
            'extract-1': {
                type: 'natural',
                flowRate: 3.0,
                shaftWidth: 1.2,
                shaftDepth: 0.9,
                activation: 'timed',
                activationTime: 60,
            },
        })

        const payload = useStore.getState().buildSavePayload()
        const floorSettings = payload.floors[0].settings

        expect(floorSettings.extractConfig).toEqual({
            'extract-1': {
                type: 'natural',
                flowRate: 3.0,
                shaftWidth: 1.2,
                shaftDepth: 0.9,
                activation: 'timed',
                activationTime: 60,
            },
        })
    })

    it('hydrateFromServer restores extractConfig', () => {
        const project = {
            id: 'proj-1',
            name: 'Test Project',
            settings: {},
        }
        const floorDetail = {
            id: 'floor-1',
            settings: {
                extractConfig: {
                    'extract-1': {
                        type: 'mechanical',
                        flowRate: 5.0,
                        shaftWidth: 1.0,
                        shaftDepth: 1.0,
                        activation: 'sprinkler',
                        activationTime: null,
                    },
                },
            },
            elements: [],
        }

        useStore.getState().hydrateFromServer(project, floorDetail)

        const state = useStore.getState()
        expect(state.extractConfig['extract-1']).toEqual({
            type: 'mechanical',
            flowRate: 5.0,
            shaftWidth: 1.0,
            shaftDepth: 1.0,
            activation: 'sprinkler',
            activationTime: null,
        })
    })

    it('resetProject clears extractConfig', () => {
        useStore.getState().setExtractConfig({
            'extract-1': {
                type: 'natural',
                flowRate: 3.0,
                shaftWidth: 0.9,
                shaftDepth: 0.9,
                activation: 'always_open',
                activationTime: null,
            },
        })

        useStore.getState().resetProject()

        expect(useStore.getState().extractConfig).toEqual({})
    })
})
