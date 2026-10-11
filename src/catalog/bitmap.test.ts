import { describe, expect, it } from 'vitest'
import { crc32, inflateSync } from 'node:zlib'
import demoTsproj from './demo/DemoMachine.tsproj?raw'
import { FIXTURES, fixture } from './__fixtures__/load'
import { bitmapDataUrl, decodeBmp, encodePng, folderIcon, sourceIcon, sourceIcons } from './bitmap'
import { importTwinCatFile } from './importFile'

/** A bottom-up BI_RGB bitmap; `rows` top row first, as the bytes of each pixel (padding added). */
function bmp(width: number, bpp: number, rows: number[][], palette: number[][] = [], height = rows.length): Uint8Array {
    const stride = Math.ceil((width * bpp) / 32) * 4
    const offset = 54 + 4 * palette.length
    const out = new Uint8Array(offset + stride * rows.length)
    const view = new DataView(out.buffer)
    out.set([0x42, 0x4d])
    view.setUint32(2, out.length, true)
    view.setUint32(10, offset, true)
    view.setUint32(14, 40, true)
    view.setInt32(18, width, true)
    view.setInt32(22, height, true)
    view.setUint16(26, 1, true)
    view.setUint16(28, bpp, true)
    view.setUint32(46, palette.length, true)
    palette.forEach((c, i) => out.set(c, 54 + 4 * i))
    rows.forEach((row, y) => out.set(row, offset + (height > 0 ? rows.length - 1 - y : y) * stride))
    return out
}

const pixel = (image: ReturnType<typeof decodeBmp>, x: number, y: number) => Array.from(image!.pixels.subarray((y * image!.width + x) * 4, (y * image!.width + x) * 4 + 4))

/** Chunks of a PNG: type and data. */
function chunks(png: Uint8Array): Array<{ type: string; data: Uint8Array }> {
    const view = new DataView(png.buffer, png.byteOffset)
    const out = []
    for (let at = 8; at < png.length; ) {
        const length = view.getUint32(at)
        const type = String.fromCharCode(...png.subarray(at + 4, at + 8))
        const data = png.subarray(at + 8, at + 8 + length)
        expect(view.getUint32(at + 8 + length)).toBe(crc32(png.subarray(at + 4, at + 8 + length)))
        out.push({ type, data })
        at += 12 + length
    }
    return out
}

describe('decodeBmp', () => {
    it('reads 24-bit bitmaps bottom-up, BGR, with magenta as transparent', () => {
        // Top row: red, magenta. Bottom row: blue, white.
        const image = decodeBmp(bmp(2, 24, [[0, 0, 255, 255, 0, 255], [255, 0, 0, 255, 255, 255]]))
        expect(image).toMatchObject({ width: 2, height: 2 })
        expect(pixel(image, 0, 0)).toEqual([255, 0, 0, 255])
        expect(pixel(image, 1, 0)).toEqual([255, 0, 255, 0])
        expect(pixel(image, 0, 1)).toEqual([0, 0, 255, 255])
        expect(pixel(image, 1, 1)).toEqual([255, 255, 255, 255])
    })
    it('reads top-down bitmaps', () => {
        const image = decodeBmp(bmp(1, 24, [[0, 0, 255], [0, 255, 0]], [], -2))
        expect([pixel(image, 0, 0), pixel(image, 0, 1)]).toEqual([
            [255, 0, 0, 255],
            [0, 255, 0, 255],
        ])
    })
    it('reads 4-bit palettes', () => {
        // Indices 1, 0, 2: green, magenta, black.
        const image = decodeBmp(bmp(3, 4, [[0x10, 0x20]], [[255, 0, 255, 0], [0, 255, 0, 0], [0, 0, 0, 0]]))
        expect([0, 1, 2].map((x) => pixel(image, x, 0))).toEqual([
            [0, 255, 0, 255],
            [255, 0, 255, 0],
            [0, 0, 0, 255],
        ])
    })
    it('keeps the alpha channel of 32-bit bitmaps, and keys magenta when it is empty', () => {
        const withAlpha = decodeBmp(bmp(2, 32, [[255, 0, 255, 128, 0, 0, 0, 0]]))
        expect([pixel(withAlpha, 0, 0), pixel(withAlpha, 1, 0)]).toEqual([
            [255, 0, 255, 128],
            [0, 0, 0, 0],
        ])
        const noAlpha = decodeBmp(bmp(2, 32, [[255, 0, 255, 0, 0, 0, 0, 0]]))
        expect([pixel(noAlpha, 0, 0), pixel(noAlpha, 1, 0)]).toEqual([
            [255, 0, 255, 0],
            [0, 0, 0, 255],
        ])
    })
    it('rejects what it cannot read', () => {
        expect(decodeBmp(new Uint8Array(10))).toBeNull()
        const compressed = bmp(1, 8, [[0]], [[0, 0, 0, 0]])
        compressed[30] = 1 // BI_RLE8
        expect(decodeBmp(compressed)).toBeNull()
        expect(decodeBmp(bmp(1, 24, [[0, 0, 0]]).subarray(0, 56))).toBeNull()
        expect(decodeBmp(bmp(1, 4, [[0x50]], [[0, 0, 0, 0]]))).toBeNull()
        expect(bitmapDataUrl('not hex')).toBeNull()
    })
})

describe('encodePng', () => {
    it('writes a valid RGBA PNG with unfiltered rows', () => {
        const pixels = Uint8Array.from({ length: 3 * 2 * 4 }, (_, i) => i)
        const png = encodePng({ width: 3, height: 2, pixels })
        expect(Array.from(png.subarray(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
        const [ihdr, idat, iend] = chunks(png)
        expect([ihdr.type, idat.type, iend.type]).toEqual(['IHDR', 'IDAT', 'IEND'])
        expect(Array.from(ihdr.data)).toEqual([0, 0, 0, 3, 0, 0, 0, 2, 8, 6, 0, 0, 0])
        const raw = inflateSync(idat.data)
        expect(Array.from(raw)).toEqual([0, ...pixels.subarray(0, 12), 0, ...pixels.subarray(12)])
    })
    it('splits large images into several stored blocks', () => {
        const pixels = new Uint8Array(200 * 200 * 4).fill(7)
        const [, idat] = chunks(encodePng({ width: 200, height: 200, pixels }))
        expect(inflateSync(idat.data).length).toBe(200 * (200 * 4 + 1))
    })
})

describe('icons of imported files', () => {
    const png = expect.stringMatching(/^data:image\/png;base64,/)

    it('gives a box exported alone its icon, as the source icon and its folder', () => {
        const [io] = importTwinCatFile('Term 2 (EL2008).xti', fixture(FIXTURES.ethercatXti))
        expect(sourceIcon(io)).toEqual(png)
        expect(folderIcon(io, 'Term 2 (EL2008)')).toBe(sourceIcon(io))
    })
    it('gives a TcCOM object its icon', () => {
        const [module] = importTwinCatFile('TempCtrl.xti', fixture(FIXTURES.tcomXti))
        expect(sourceIcon(module)).toEqual(png)
    })
    it('maps box folders of a device to their icons, each image once; built-in image ids have none', () => {
        const io = importTwinCatFile('DemoMachine.tsproj', demoTsproj).find((s) => s.kind === 'IO')!
        expect(sourceIcon(io)).toBeUndefined()
        expect(folderIcon(io, 'Term 3 (EL2008)')).toEqual(png)
        expect(folderIcon(io, 'Term 5 (EL7041)')).toBe(folderIcon(io, 'Term 6 (EL7041)'))
        // EL1008 uses TwinCAT's built-in image 7; the coupler has no symbols, so no folder.
        expect(folderIcon(io, 'Term 2 (EL1008)')).toBeUndefined()
        expect(Object.keys(io.icons!.folders!)).toEqual(['Term 3 (EL2008)', 'Term 4 (EL3102)', 'Term 5 (EL7041)', 'Term 6 (EL7041)'])
        expect(io.icons!.images).toHaveLength(3)
    })
    it('leaves sources without images without icons', () => {
        expect(sourceIcons(undefined, [['a', undefined]])).toBeUndefined()
        const [nc] = importTwinCatFile('DemoMachine.tsproj', demoTsproj)
        expect(nc.icons).toBeUndefined()
    })
})
