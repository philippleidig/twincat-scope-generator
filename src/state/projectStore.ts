import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AxisGroup, Project, ScopeFile } from '@/domain/project'
import { createProject, ops, parseProject } from '@/domain/project'

type Ops = typeof ops
/** Every pure project operation, bound to the store: `(project, ...args) => project` becomes `(...args) => void`. */
type BoundOps = {
    [K in keyof Ops]: Ops[K] extends (p: Project, ...args: infer A) => Project ? (...args: A) => void : never
}

interface Selection {
    /** Scope file tab shown in the editor. */
    activeFileId: string | null
    /** Axis group that "Add to scope" in the symbol browser targets. */
    activeAxisGroupId: string | null
}

interface ProjectState extends BoundOps, Selection {
    project: Project
    selectFile: (id: string) => void
    setActiveAxisGroup: (id: string) => void
    /** Replace the project in one step (bulk changes, opened files); keeps the selection valid. */
    commit: (project: Project) => void
    reset: () => void
}

/**
 * The selection always points at an existing file and, if that file has axis groups, at one
 * of them. Every change goes through here, so no component has to repair it.
 */
function normalize(project: Project, wanted: Selection): Selection & { project: Project } {
    const file = project.scopeFiles.find((f) => f.id === wanted.activeFileId) ?? project.scopeFiles[0]
    const group = file?.axisGroups.find((a) => a.id === wanted.activeAxisGroupId) ?? file?.axisGroups[0]
    return { project, activeFileId: file?.id ?? null, activeAxisGroupId: group?.id ?? null }
}

const initial = createProject()

export const useProjectStore = create<ProjectState>()(
    persist(
        (set) => {
            const bound = Object.fromEntries(
                Object.entries(ops).map(([name, op]) => [
                    name,
                    (...args: unknown[]) =>
                        set((s) => normalize((op as (p: Project, ...a: unknown[]) => Project)(s.project, ...args), s)),
                ]),
            ) as BoundOps

            return {
                ...bound,
                ...normalize(initial, { activeFileId: null, activeAxisGroupId: null }),
                selectFile: (id) => set((s) => normalize(s.project, { activeFileId: id, activeAxisGroupId: null })),
                setActiveAxisGroup: (id) =>
                    set((s) => {
                        const file = s.project.scopeFiles.find((f) => f.axisGroups.some((a) => a.id === id))
                        return file ? { activeFileId: file.id, activeAxisGroupId: id } : {}
                    }),
                commit: (project) => set((s) => normalize(project, s)),
                reset: () => set(normalize(createProject(), { activeFileId: null, activeAxisGroupId: null })),
            }
        },
        {
            name: 'twincat-scope-project',
            version: 2,
            partialize: (s) => ({ project: s.project, activeFileId: s.activeFileId, activeAxisGroupId: s.activeAxisGroupId }),
            // Persisted state is untrusted input (other versions, manual edits): re-validate it.
            merge: (persisted, current) => {
                const p = (persisted ?? {}) as Partial<Record<keyof Selection | 'project', unknown>>
                try {
                    const selection = {
                        activeFileId: typeof p.activeFileId === 'string' ? p.activeFileId : null,
                        activeAxisGroupId: typeof p.activeAxisGroupId === 'string' ? p.activeAxisGroupId : null,
                    }
                    return { ...current, ...normalize(parseProject(p.project), selection) }
                } catch {
                    return current
                }
            },
        },
    ),
)

export const selectActiveFile = (s: ProjectState): ScopeFile | undefined =>
    s.project.scopeFiles.find((f) => f.id === s.activeFileId)

export const selectActiveGroup = (s: ProjectState): AxisGroup | undefined =>
    selectActiveFile(s)?.axisGroups.find((a) => a.id === s.activeAxisGroupId)
