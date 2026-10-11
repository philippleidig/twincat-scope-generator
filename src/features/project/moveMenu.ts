/**
 * "Move to…" menus: the keyboard and pointer alternative to dragging channels and axis groups.
 * Built from the store when a menu opens, so the rows do not re-render on every change.
 */
import { locateAxisGroup, locateChannel, scopeFileLabel } from '@/domain/project'
import { useProjectStore } from '@/state/projectStore'
import type { MenuItem } from '@/ui/components/Menu'

/**
 * A move to another parent remounts the moved item there (or hides it, when its new file is not
 * shown), so focus would fall to <body>. Once React has rendered the move, focus the first of
 * `selectors` that exists: the moved item's menu trigger, else the destination's file tab.
 */
function focusAfterMove(...selectors: string[]): void {
    setTimeout(() => {
        for (const selector of selectors) {
            const el = document.querySelector<HTMLElement>(selector)
            if (el) return el.focus()
        }
    })
}

const fileTab = (fileId: string) => `[role="tab"][data-file-id="${fileId}"]`

/**
 * "Move up" / "Move down" for the item at `index` of a list of `length`. `moveTo` takes a slot
 * of the list as shown (like the move ops), so one place down is slot `index + 2`.
 */
function stepItems(index: number, length: number, moveTo: (slot: number) => void): MenuItem[] {
    const moveBy = (delta: -1 | 1) => moveTo(delta < 0 ? index - 1 : index + 2)
    return [
        { key: 'up', label: 'Move up', disabled: index === 0, onSelect: () => moveBy(-1) },
        { key: 'down', label: 'Move down', disabled: index === length - 1, onSelect: () => moveBy(1) },
    ]
}

/** Up/down within the axis group, then every other axis group of every file (appended there). */
export function channelMoveItems(channelId: string): MenuItem[] {
    const { project, moveChannel } = useProjectStore.getState()
    const at = locateChannel(project, channelId)
    if (!at) return []
    const group = at.parent
    return [
        ...stepItems(at.index, group.channels.length, (slot) => moveChannel(channelId, group.id, slot)),
        ...project.scopeFiles.flatMap((f) =>
            f.axisGroups
                .filter((g) => g.id !== group.id)
                .map((g) => ({
                    key: g.id,
                    label: `Move to ${scopeFileLabel(f)} › ${g.name}`,
                    onSelect: () => {
                        moveChannel(channelId, g.id)
                        focusAfterMove(`[data-channel-id="${channelId}"] [aria-haspopup="menu"]`, fileTab(f.id))
                    },
                })),
        ),
    ]
}

/** Up/down within the scope file, then every other scope file (appended there). */
export function axisGroupMoveItems(axisGroupId: string): MenuItem[] {
    const { project, moveAxisGroup } = useProjectStore.getState()
    const at = locateAxisGroup(project, axisGroupId)
    if (!at) return []
    const file = at.parent
    return [
        ...stepItems(at.index, file.axisGroups.length, (slot) => moveAxisGroup(axisGroupId, file.id, slot)),
        ...project.scopeFiles
            .filter((f) => f.id !== file.id)
            .map((f) => ({
                key: f.id,
                label: `Move to ${scopeFileLabel(f)}`,
                onSelect: () => {
                    moveAxisGroup(axisGroupId, f.id)
                    focusAfterMove(`[data-axis-group-id="${axisGroupId}"] [aria-haspopup="menu"]`, fileTab(f.id))
                },
            })),
    ]
}
