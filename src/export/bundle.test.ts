import { describe, expect, it, vi } from 'vitest'
import JSZip from 'jszip'
import { createZipArchive, downloadBlob } from './bundle'

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
