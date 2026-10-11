import { afterEach, describe, expect, it, vi } from 'vitest'
import { PICK_MIME } from '@/state/browserStore'
import { AXIS_GROUP_MIME, CHANNEL_MIME, dragKind, isCopyDrag, readAxisGroupDrag, readChannelDrag } from './dnd'

const data = (value: string) => ({ getData: () => value })

afterEach(() => vi.restoreAllMocks())

describe('dnd', () => {
    it('tells what is being dragged from the types alone', () => {
        expect(dragKind([CHANNEL_MIME])).toBe('channel')
        expect(dragKind([AXIS_GROUP_MIME])).toBe('axis-group')
        expect(dragKind([PICK_MIME, 'text/plain'])).toBe('picks')
        expect(dragKind(['text/plain'])).toBe('text')
        expect(dragKind(['Files'])).toBeNull()
    })

    it('reads payloads defensively', () => {
        expect(readChannelDrag(data('{"channelId":"c1"}'))).toBe('c1')
        expect(readAxisGroupDrag(data('{"axisGroupId":"g1"}'))).toBe('g1')
        expect(readChannelDrag(data('{"axisGroupId":"g1"}'))).toBeNull()
        expect(readChannelDrag(data('{"channelId":3}'))).toBeNull()
        expect(readChannelDrag(data('null'))).toBeNull()
        expect(readChannelDrag(data(''))).toBeNull()
    })

    it('copies with Ctrl, or with Option on macOS', () => {
        expect(isCopyDrag({ ctrlKey: true, altKey: false })).toBe(true)
        expect(isCopyDrag({ ctrlKey: false, altKey: true })).toBe(false)
        vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel')
        expect(isCopyDrag({ ctrlKey: false, altKey: true })).toBe(true)
        expect(isCopyDrag({ ctrlKey: true, altKey: false })).toBe(false)
    })
})
