import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Project } from '@/domain/project'
import { createProject, ops, parseProject } from '@/domain/project'

type Ops = typeof ops
/** Every pure project operation, bound to the store: `(project, ...args) => project` becomes `(...args) => void`. */
type BoundOps = {
    [K in keyof Ops]: Ops[K] extends (p: Project, ...args: infer A) => Project ? (...args: A) => void : never
}

interface ProjectState extends BoundOps {
    project: Project
    /** Scope file tab shown in the editor. */
    activeFileId: string | null
    /** Axis group that "Add to scope" in the symbol browser targets. */
    activeAxisGroupId: string | null
    selectFile: (id: string) => void
    setActiveAxisGroup: (id: string) => void
    replaceProject: (project: Project) => void
    reset: () => void
}

const initial = createProject()

function firstSelection(project: Project): Pick<ProjectState, 'activeFileId' | 'activeAxisGroupId'> {
    const file = project.scopeFiles[0]
    return { activeFileId: file?.id ?? null, activeAxisGroupId: file?.axisGroups[0]?.id ?? null }
}

export const useProjectStore = create<ProjectState>()(
    persist(
        (set) => {
            const bound = Object.fromEntries(
                Object.entries(ops).map(([name, op]) => [
                    name,
                    (...args: unknown[]) =>
                        set((s) => ({ project: (op as (p: Project, ...a: unknown[]) => Project)(s.project, ...args) })),
                ]),
            ) as BoundOps

            return {
                ...bound,
                project: initial,
                ...firstSelection(initial),
                selectFile: (id) =>
                    set((s) => {
                        const file = s.project.scopeFiles.find((f) => f.id === id)
                        return file ? { activeFileId: id, activeAxisGroupId: file.axisGroups[0]?.id ?? null } : {}
                    }),
                setActiveAxisGroup: (id) =>
                    set((s) => {
                        const file = s.project.scopeFiles.find((f) => f.axisGroups.some((a) => a.id === id))
                        return file ? { activeFileId: file.id, activeAxisGroupId: id } : {}
                    }),
                replaceProject: (project) => set({ project, ...firstSelection(project) }),
                reset: () => {
                    const project = createProject()
                    set({ project, ...firstSelection(project) })
                },
            }
        },
        {
            name: 'twincat-scope-project',
            version: 2,
            partialize: (s) => ({ project: s.project, activeFileId: s.activeFileId, activeAxisGroupId: s.activeAxisGroupId }),
            // Persisted state is untrusted input (other versions, manual edits): re-validate it.
            merge: (persisted, current) => {
                const p = persisted as { project?: unknown; activeFileId?: unknown; activeAxisGroupId?: unknown } | undefined
                try {
                    const project = parseProject(p?.project)
                    const file = project.scopeFiles.find((f) => f.id === p?.activeFileId)
                    const group = file?.axisGroups.find((a) => a.id === p?.activeAxisGroupId)
                    return file
                        ? { ...current, project, activeFileId: file.id, activeAxisGroupId: group?.id ?? file.axisGroups[0]?.id ?? null }
                        : { ...current, project, ...firstSelection(project) }
                } catch {
                    return current
                }
            },
        },
    ),
)
