/**
 * "Move to…" menus: the keyboard and pointer alternative to dragging channels and axis groups.
 * Built from the project when the menu opens, so the rows do not re-render on every change.
 */
import type { Project } from '@/domain/project'
import type { MenuItem } from '@/ui/components/Menu'

interface ChannelMoves {
    moveChannel: (id: string, toAxisGroupId: string, index?: number) => void
}

interface AxisGroupMoves {
    moveAxisGroup: (id: string, toFileId: string, index?: number) => void
}

/** Up/down within the axis group, then every other axis group of every file. */
export function channelMoveItems(project: Project, channelId: string, { moveChannel }: ChannelMoves): MenuItem[] {
    for (const file of project.scopeFiles) {
        for (const group of file.axisGroups) {
            const index = group.channels.findIndex((c) => c.id === channelId)
            if (index === -1) continue
            const others = project.scopeFiles.flatMap((f) =>
                f.axisGroups
                    .filter((g) => g.id !== group.id)
                    .map((g) => ({ key: g.id, label: `Move to ${f.name} › ${g.name}`, onSelect: () => moveChannel(channelId, g.id) })),
            )
            return [
                { key: 'up', label: 'Move up', disabled: index === 0, onSelect: () => moveChannel(channelId, group.id, index - 1) },
                {
                    key: 'down',
                    label: 'Move down',
                    disabled: index === group.channels.length - 1,
                    onSelect: () => moveChannel(channelId, group.id, index + 2),
                },
                ...others,
            ]
        }
    }
    return []
}

/** Up/down within the scope file, then every other scope file (appended there). */
export function axisGroupMoveItems(project: Project, axisGroupId: string, { moveAxisGroup }: AxisGroupMoves): MenuItem[] {
    for (const file of project.scopeFiles) {
        const index = file.axisGroups.findIndex((a) => a.id === axisGroupId)
        if (index === -1) continue
        return [
            { key: 'up', label: 'Move up', disabled: index === 0, onSelect: () => moveAxisGroup(axisGroupId, file.id, index - 1) },
            {
                key: 'down',
                label: 'Move down',
                disabled: index === file.axisGroups.length - 1,
                onSelect: () => moveAxisGroup(axisGroupId, file.id, index + 2),
            },
            ...project.scopeFiles
                .filter((f) => f.id !== file.id)
                .map((f) => ({ key: f.id, label: `Move to ${f.name}`, onSelect: () => moveAxisGroup(axisGroupId, f.id) })),
        ]
    }
    return []
}
