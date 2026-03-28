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

    it('extractConfig includes openingHeight and openingBase', () => {
        useStore.getState().setExtractConfig({
            'extract-1': {
                type: 'natural',
                flowRate: 3.0,
                shaftWidth: 0.9,
                shaftDepth: 0.9,
                openingHeight: 0.8,
                openingBase: 1.5,
                activation: 'always_open',
                activationTime: null,
            },
        })

        const config = useStore.getState().extractConfig
        expect(config['extract-1'].openingHeight).toBe(0.8)
        expect(config['extract-1'].openingBase).toBe(1.5)
    })

    it('openingHeight persists in buildSavePayload', () => {
        useStore.getState().setExtractConfig({
            'extract-1': {
                type: 'natural',
                flowRate: 3.0,
                shaftWidth: 0.9,
                shaftDepth: 0.9,
                openingHeight: 0.8,
                openingBase: 1.5,
                activation: 'always_open',
                activationTime: null,
            },
        })

        const payload = useStore.getState().buildSavePayload()
        const floorSettings = payload.floors[0].settings
        expect(floorSettings.extractConfig['extract-1'].openingHeight).toBe(0.8)
        expect(floorSettings.extractConfig['extract-1'].openingBase).toBe(1.5)
    })

    it('hydrateFromServer restores openingHeight and openingBase', () => {
        const project = { id: 'proj-1', name: 'Test', settings: {} }
        const floorDetail = {
            id: 'floor-1',
            settings: {
                extractConfig: {
                    'extract-1': {
                        type: 'natural',
                        flowRate: 3.0,
                        shaftWidth: 0.9,
                        shaftDepth: 0.9,
                        openingHeight: 0.8,
                        openingBase: 1.5,
                        activation: 'always_open',
                        activationTime: null,
                    },
                },
            },
            elements: [],
        }

        useStore.getState().hydrateFromServer(project, floorDetail)
        const config = useStore.getState().extractConfig
        expect(config['extract-1'].openingHeight).toBe(0.8)
        expect(config['extract-1'].openingBase).toBe(1.5)
    })

    it('tauV persists in extractConfig', () => {
        useStore.getState().setExtractConfig({
            'extract-1': {
                type: 'mechanical',
                flowRate: 6.0,
                tauV: -10,
                shaftWidth: 0.9,
                shaftDepth: 0.9,
                activation: 'always_open',
                activationTime: null,
            },
        })

        const config = useStore.getState().extractConfig
        expect(config['extract-1'].tauV).toBe(-10)
    })

    it('tauV persists in buildSavePayload', () => {
        useStore.getState().setExtractConfig({
            'extract-1': {
                type: 'mechanical',
                flowRate: 6.0,
                tauV: -15,
                shaftWidth: 0.9,
                shaftDepth: 0.9,
                activation: 'always_open',
                activationTime: null,
            },
        })

        const payload = useStore.getState().buildSavePayload()
        const floorSettings = payload.floors[0].settings
        expect(floorSettings.extractConfig['extract-1'].tauV).toBe(-15)
    })

    it('hydrateFromServer restores tauV', () => {
        const project = { id: 'proj-1', name: 'Test', settings: {} }
        const floorDetail = {
            id: 'floor-1',
            settings: {
                extractConfig: {
                    'extract-1': {
                        type: 'mechanical',
                        flowRate: 6.0,
                        tauV: -10,
                        shaftWidth: 0.9,
                        shaftDepth: 0.9,
                        activation: 'always_open',
                        activationTime: null,
                    },
                },
            },
            elements: [],
        }

        useStore.getState().hydrateFromServer(project, floorDetail)
        expect(useStore.getState().extractConfig['extract-1'].tauV).toBe(-10)
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

describe('Store: inlet config with mechanical supply', () => {
    beforeEach(() => {
        useStore.getState().setInletConfig({})
    })

    it('default inletConfig is {}', () => {
        expect(useStore.getState().inletConfig).toEqual({})
    })

    it('setInletConfig stores per-inlet config with type, flowRate, tauV', () => {
        useStore.getState().setInletConfig({
            'inlet-1': {
                type: 'mechanical',
                flowRate: 4.5,
                tauV: -10,
                openingHeight: 0.8,
                openingBase: 0.0,
            },
        })

        const config = useStore.getState().inletConfig
        expect(config['inlet-1'].type).toBe('mechanical')
        expect(config['inlet-1'].flowRate).toBe(4.5)
        expect(config['inlet-1'].tauV).toBe(-10)
    })

    it('inletConfig persists in buildSavePayload', () => {
        useStore.getState().setInletConfig({
            'inlet-1': {
                type: 'mechanical',
                flowRate: 3.0,
                tauV: -15,
                openingHeight: 0.8,
                openingBase: 0.0,
            },
        })

        const payload = useStore.getState().buildSavePayload()
        const floorSettings = payload.floors[0].settings
        expect(floorSettings.inletConfig['inlet-1'].type).toBe('mechanical')
        expect(floorSettings.inletConfig['inlet-1'].flowRate).toBe(3.0)
        expect(floorSettings.inletConfig['inlet-1'].tauV).toBe(-15)
    })

    it('hydrateFromServer restores inletConfig with mechanical fields', () => {
        const project = { id: 'proj-1', name: 'Test', settings: {} }
        const floorDetail = {
            id: 'floor-1',
            settings: {
                inletConfig: {
                    'inlet-1': {
                        type: 'mechanical',
                        flowRate: 4.5,
                        tauV: -10,
                        openingHeight: 0.8,
                        openingBase: 0.0,
                    },
                },
            },
            elements: [],
        }

        useStore.getState().hydrateFromServer(project, floorDetail)
        const config = useStore.getState().inletConfig
        expect(config['inlet-1'].type).toBe('mechanical')
        expect(config['inlet-1'].flowRate).toBe(4.5)
        expect(config['inlet-1'].tauV).toBe(-10)
    })

    it('natural inlet config has no flowRate or tauV required', () => {
        useStore.getState().setInletConfig({
            'inlet-1': {
                type: 'natural',
                openingHeight: 0.8,
                openingBase: 0.0,
            },
        })

        const config = useStore.getState().inletConfig
        expect(config['inlet-1'].type).toBe('natural')
        expect(config['inlet-1'].flowRate).toBeUndefined()
    })

    it('resetProject clears inletConfig', () => {
        useStore.getState().setInletConfig({
            'inlet-1': { type: 'mechanical', flowRate: 3.0, tauV: -10, openingHeight: 0.8, openingBase: 0.0 },
        })

        useStore.getState().resetProject()

        expect(useStore.getState().inletConfig).toEqual({})
    })
})
