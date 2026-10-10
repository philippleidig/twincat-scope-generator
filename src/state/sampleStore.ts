import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuid } from 'uuid'

/** A reusable symbol template from the pattern library. */
export interface Sample {
    id: string
    template: string
    description: string
}

export const DEFAULT_SAMPLES: Sample[] = [
    { id: 'default-1', template: 'MAIN.mover[{i:1:5}].position', description: 'Position of 5 movers' },
    { id: 'default-2', template: 'MAIN.mover[{i:1:3}].stMoverRef.NcToPlc.SetVelo', description: 'Mover velocity setpoint' },
    { id: 'default-3', template: 'Mover Axis {i:1:10}.SoftDrive {i:1:10}.SdScopeVariable.ActPos', description: 'Same counter twice: 10 NC axes' },
    { id: 'default-4', template: 'GVL.station[{s:1:4}].sensor[{n:1:8}].value', description: 'Two counters: 4 stations × 8 sensors' },
    { id: 'default-5', template: 'GVL.aAxis[{i:01:12}].fActPos', description: 'Zero padded: 01 … 12' },
]

interface SampleState {
    samples: Sample[]
    addSample: (template: string, description: string) => void
    updateSample: (id: string, patch: Partial<Omit<Sample, 'id'>>) => void
    removeSample: (id: string) => void
    resetToDefaults: () => void
    /** Replace the library with valid entries from parsed JSON; returns how many were imported. */
    importSamples: (json: unknown) => number
    exportSamples: () => string
}

export const useSampleStore = create<SampleState>()(
    persist(
        (set, get) => ({
            samples: DEFAULT_SAMPLES,
            addSample: (template, description) =>
                set((s) => ({ samples: [...s.samples, { id: uuid(), template, description }] })),
            updateSample: (id, patch) =>
                set((s) => ({ samples: s.samples.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
            removeSample: (id) => set((s) => ({ samples: s.samples.filter((x) => x.id !== id) })),
            resetToDefaults: () => set({ samples: DEFAULT_SAMPLES }),
            importSamples: (json) => {
                const valid = (Array.isArray(json) ? json : [])
                    .filter((x): x is { template: string; description?: unknown } =>
                        !!x && typeof x === 'object' && typeof x.template === 'string' && x.template.trim() !== '',
                    )
                    .map((x) => ({
                        id: uuid(),
                        template: x.template.trim(),
                        description: typeof x.description === 'string' ? x.description : '',
                    }))
                if (valid.length > 0) set({ samples: valid })
                return valid.length
            },
            exportSamples: () =>
                JSON.stringify(get().samples.map(({ template, description }) => ({ template, description })), null, 2),
        }),
        { name: 'twincat-scope-samples' },
    ),
)
