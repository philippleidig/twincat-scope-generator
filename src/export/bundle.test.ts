import { afterEach, describe, expect, it, vi } from 'vitest'
import JSZip from 'jszip'
import { canShareZip, createZipArchive, downloadBlob, shareZip } from './bundle'

describe('createZipArchive', () => {
    it('contains every scope file and the project file', async () => {
        const blob = await createZipArchive({
            scopeFiles: [
                { fileName: 'A.tcscopex', content: '<a/>', acquisitionCount: 1 },
                { fileName: 'B.tcscopex', content: '<b/>', acquisitionCount: 1 },
            ],
            tcmproj: { fileName: 'P.tcmproj', content: '<p/>', acquisitionCount: 2 },
        })
        const zip = await JSZip.loadAsync(await blob.arrayBuffer())
        expect(Object.keys(zip.files).sort()).toEqual(['A.tcscopex', 'B.tcscopex', 'P.tcmproj'])
        expect(await zip.file('B.tcscopex')!.async('string')).toBe('<b/>')
    })
})

describe('downloadBlob', () => {
    it('clicks a temporary link and revokes the object URL', () => {
        vi.useFakeTimers()
        const create = vi.fn(() => 'blob:x')
        const revoke = vi.fn()
        Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke })
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
        downloadBlob(new Blob(['x']), 'f.zip')
        expect(click).toHaveBeenCalled()
        expect(document.querySelector('a[download]')).toBeNull()
        vi.runAllTimers()
        expect(revoke).toHaveBeenCalledWith('blob:x')
        vi.useRealTimers()
    })
})

describe('sharing', () => {
    const stub = (props: Partial<Navigator>) => {
        for (const [key, value] of Object.entries(props)) Object.defineProperty(navigator, key, { value, configurable: true })
    }
    afterEach(() => {
        Reflect.deleteProperty(navigator, 'canShare')
        Reflect.deleteProperty(navigator, 'share')
    })

    it('needs the browser to accept a zip file', () => {
        expect(canShareZip()).toBe(false)
        const canShare = vi.fn((data?: ShareData) => data?.files?.[0]?.name.endsWith('.zip') === true)
        stub({ canShare })
        expect(canShareZip()).toBe(true)
        stub({ canShare: () => false })
        expect(canShareZip()).toBe(false)
        stub({
            canShare: () => {
                throw new TypeError('no files')
            },
        })
        expect(canShareZip()).toBe(false)
    })

    it('attaches the zip and treats a closed share sheet as not shared', async () => {
        const share = vi.fn(async (data?: ShareData) => {
            expect(data?.files?.[0]).toMatchObject({ name: 'P_scope.zip', type: 'application/zip' })
        })
        stub({ share })
        expect(await shareZip(new Blob(['x']), 'P_scope.zip', 'P')).toBe(true)
        expect(share).toHaveBeenCalledWith(expect.objectContaining({ title: 'P' }))

        stub({ share: vi.fn().mockRejectedValue(new DOMException('closed', 'AbortError')) })
        expect(await shareZip(new Blob(['x']), 'P_scope.zip', 'P')).toBe(false)

        stub({ share: vi.fn().mockRejectedValue(new DOMException('blocked', 'NotAllowedError')) })
        await expect(shareZip(new Blob(['x']), 'P_scope.zip', 'P')).rejects.toThrow('blocked')
    })
})
