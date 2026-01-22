import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import type { Sample } from '@/types'
import { DEFAULT_SAMPLES } from '@/types'

interface SampleStore {
    // State
    samples: Sample[]

    // Actions
    addSample: (template: string, description: string) => void
    updateSample: (id: string, updates: Partial<Omit<Sample, 'id'>>) => void
    removeSample: (id: string) => void
    resetToDefaults: () => void
    importSamples: (samples: Sample[]) => void
    exportSamples: () => string
}

export const useSampleStore = create<SampleStore>()(
    persist(
        (set, get) => ({
            // Initial State
            samples: [...DEFAULT_SAMPLES],

            // Add a new sample
            addSample: (template, description) =>
                set((state) => ({
                    samples: [
                        ...state.samples,
                        {
                            id: uuidv4(),
                            template,
                            description,
                        },
                    ],
                })),

            // Update an existing sample
            updateSample: (id, updates) =>
                set((state) => ({
                    samples: state.samples.map((s) =>
                        s.id === id ? { ...s, ...updates } : s
                    ),
                })),

            // Remove a sample
            removeSample: (id) =>
                set((state) => ({
                    samples: state.samples.filter((s) => s.id !== id),
                })),

            // Reset to default samples
            resetToDefaults: () =>
                set({
                    samples: DEFAULT_SAMPLES.map((s) => ({ ...s })),
                }),

            // Import samples from JSON array
            importSamples: (importedSamples) => {
                const validSamples = importedSamples
                    .filter(
                        (s) =>
                            typeof s.template === 'string' &&
                            typeof s.description === 'string' &&
                            s.template.trim() !== ''
                    )
                    .map((s) => ({
                        id: uuidv4(),
                        template: s.template,
                        description: s.description || '',
                    }))

                if (validSamples.length > 0) {
                    set({ samples: validSamples })
                }
            },

            // Export samples as JSON string
            exportSamples: () => {
                const samples = get().samples.map(({ template, description }) => ({
                    template,
                    description,
                }))
                return JSON.stringify(samples, null, 2)
            },
        }),
        {
            name: 'twincat-scope-samples',
        }
    )
)
