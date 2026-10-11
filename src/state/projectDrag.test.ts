import { describe, expect, it } from 'vitest'
import {
    AXIS_GROUP_MIME,
    CHANNEL_MIME,
    PICK_MIME,
    dragKind,
    readProjectDrag,
    setAxisGroupDragData,
    setChannelDragData,
    setPickDragData,
} from './projectDrag'

const data = (type: string, value: string) => ({ types: [type], getData: (t: string) => (t === type ? value : '') })

describe('projectDrag', () => {
    it('tells what is being dragged from the types alone', () => {
        expect(dragKind([CHANNEL_MIME])).toBe('channel')
        expect(dragKind([AXIS_GROUP_MIME])).toBe('axis-group')
        expect(dragKind([PICK_MIME, 'text/plain'])).toBe('picks')
        expect(dragKind(['text/plain'])).toBe('text')
        expect(dragKind(['Files'])).toBeNull()
    })

    it('round-trips channel and axis group payloads', () => {
        const stored = new Map<string, string>()
        const dt = { setData: (t: string, v: string) => stored.set(t, v), effectAllowed: 'all' } as unknown as DataTransfer
        setChannelDragData(dt, 'c1')
        setAxisGroupDragData(dt, 'g1')
        expect(dt.effectAllowed).toBe('copyMove')
        expect(readProjectDrag(data(CHANNEL_MIME, stored.get(CHANNEL_MIME)!))).toEqual({ kind: 'channel', id: 'c1' })
        expect(readProjectDrag(data(AXIS_GROUP_MIME, stored.get(AXIS_GROUP_MIME)!))).toEqual({ kind: 'axis-group', id: 'g1' })
    })

    it('round-trips browser picks', () => {
        const stored = new Map<string, string>()
        const dt = { setData: (t: string, v: string) => stored.set(t, v), effectAllowed: 'all' } as unknown as DataTransfer
        const pick = { key: 'k', sourceId: 's', path: 'MAIN.x', kind: 'scalar' as const }
        setPickDragData(dt, [pick])
        expect(dt.effectAllowed).toBe('copy')
        expect(readProjectDrag(data(PICK_MIME, stored.get(PICK_MIME)!))).toEqual({ kind: 'picks', picks: [pick] })
    })

    it('decodes picks and text, and rejects malformed payloads', () => {
        const pick = { key: 'k', sourceId: 's', path: 'MAIN.x' }
        expect(readProjectDrag(data(PICK_MIME, JSON.stringify([pick, { path: 3 }])))).toEqual({ kind: 'picks', picks: [pick] })
        expect(readProjectDrag(data(PICK_MIME, '{broken'))).toEqual({ kind: 'picks', picks: [] })
        expect(readProjectDrag(data('text/plain', '<x/>'))).toEqual({ kind: 'text', text: '<x/>' })
        expect(readProjectDrag(data(CHANNEL_MIME, '{"axisGroupId":"g1"}'))).toBeNull()
        expect(readProjectDrag(data(CHANNEL_MIME, '{"channelId":3}'))).toBeNull()
        expect(readProjectDrag(data(AXIS_GROUP_MIME, 'null'))).toBeNull()
        expect(readProjectDrag(data(CHANNEL_MIME, ''))).toBeNull()
        expect(readProjectDrag(data('Files', ''))).toBeNull()
    })
})
