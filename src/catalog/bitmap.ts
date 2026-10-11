/**
 * The icons TwinCAT stores in System Manager files (`<ImageDatas><ImageData Id>` with a hex BMP,
 * referenced by `<ImageId>` of a box or TcCOM module) as PNG data URLs the browser can show.
 *
 * The bitmaps are small (16×16, 16×14) Windows BMPs with 4, 8, 24 or 32 bits per pixel; magenta
 * (#FF00FF) is the transparent colour, unless a 32-bit bitmap has an alpha channel of its own.
 * The PNG is written uncompressed (stored deflate blocks): no dependency, and a 16×16 icon is ~1 KB.
 */

import type { SourceIcons } from './model'

const MAX_SIDE = 256

export interface Rgba {
    width: number
    height: number
    /** Row-major, top row first, 4 bytes per pixel. */
    pixels: Uint8Array
}

function hexToBytes(hex: string): Uint8Array | null {
    const clean = hex.replace(/\s+/g, '')
    if (clean.length % 2 !== 0 || /[^0-9a-f]/i.test(clean)) return null
    const bytes = new Uint8Array(clean.length / 2)
    for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(clean.slice(2 * i, 2 * i + 2), 16)
    return bytes
}

/** Uncompressed BMP (BI_RGB, or BI_BITFIELDS with 32 bits) → RGBA; null for anything else. */
export function decodeBmp(bytes: Uint8Array): Rgba | null {
    if (bytes.length < 54 || bytes[0] !== 0x42 || bytes[1] !== 0x4d) return null
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const dataOffset = view.getUint32(10, true)
    const headerSize = view.getUint32(14, true)
    const width = view.getInt32(18, true)
    const rawHeight = view.getInt32(22, true)
    const bpp = view.getUint16(28, true)
    const compression = view.getUint32(30, true)
    const height = Math.abs(rawHeight)
    if (width <= 0 || height === 0 || width > MAX_SIDE || height > MAX_SIDE) return null
    if (!(compression === 0 || (compression === 3 && bpp === 32))) return null
    if (![1, 4, 8, 24, 32].includes(bpp)) return null

    const paletteSize = bpp <= 8 ? view.getUint32(46, true) || 1 << bpp : 0
    const paletteStart = 14 + headerSize
    const stride = Math.ceil((width * bpp) / 32) * 4
    if (dataOffset + stride * height > bytes.length || paletteStart + 4 * paletteSize > bytes.length) return null

    const pixels = new Uint8Array(width * height * 4)
    let hasAlpha = false
    for (let y = 0; y < height; y++) {
        // Bottom-up unless the height is negative.
        const row = dataOffset + (rawHeight > 0 ? height - 1 - y : y) * stride
        for (let x = 0; x < width; x++) {
            // Source of the pixel's blue, green, red (and alpha) bytes.
            let at: number
            if (bpp >= 24) {
                at = row + (bpp / 8) * x
            } else {
                const bit = x * bpp
                const index = (bytes[row + (bit >> 3)] >> (8 - bpp - (bit & 7))) & ((1 << bpp) - 1)
                if (index >= paletteSize) return null
                at = paletteStart + 4 * index
            }
            const out = (y * width + x) * 4
            pixels[out] = bytes[at + 2]
            pixels[out + 1] = bytes[at + 1]
            pixels[out + 2] = bytes[at]
            pixels[out + 3] = bpp === 32 ? bytes[at + 3] : 255
            if (bpp === 32 && bytes[at + 3] !== 0) hasAlpha = true
        }
    }
    // Without an alpha channel of its own, magenta is transparent and everything else opaque.
    if (!hasAlpha) {
        for (let i = 0; i < pixels.length; i += 4) {
            pixels[i + 3] = pixels[i] === 255 && pixels[i + 1] === 0 && pixels[i + 2] === 255 ? 0 : 255
        }
    }
    return { width, height, pixels }
}

// ---------------------------------------------------------------------------
// PNG
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
    const table = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
        let c = n
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
        table[n] = c >>> 0
    }
    return table
})()

function crc32(bytes: Uint8Array): number {
    let c = 0xffffffff
    for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
}

function adler32(bytes: Uint8Array): number {
    let a = 1
    let b = 0
    for (const byte of bytes) {
        a = (a + byte) % 65521
        b = (b + a) % 65521
    }
    return ((b << 16) | a) >>> 0
}

const u32 = (n: number) => Uint8Array.of((n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff)

function concat(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
    let at = 0
    for (const part of parts) {
        out.set(part, at)
        at += part.length
    }
    return out
}

const MAX_STORED = 0xffff

/** zlib stream of stored (uncompressed) deflate blocks. */
function zlibStored(data: Uint8Array): Uint8Array {
    const parts: Uint8Array[] = [Uint8Array.of(0x78, 0x01)]
    let start = 0
    do {
        const block = data.subarray(start, start + MAX_STORED)
        start += MAX_STORED
        const final = start >= data.length ? 1 : 0
        parts.push(Uint8Array.of(final, block.length & 0xff, block.length >> 8, ~block.length & 0xff, (~block.length >> 8) & 0xff), block)
    } while (start < data.length)
    parts.push(u32(adler32(data)))
    return concat(parts)
}

function chunk(type: string, data: Uint8Array): Uint8Array {
    const typed = concat([Uint8Array.from(type, (c) => c.charCodeAt(0)), data])
    return concat([u32(data.length), typed, u32(crc32(typed))])
}

const PNG_SIGNATURE = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)

export function encodePng({ width, height, pixels }: Rgba): Uint8Array {
    // Every row starts with filter type 0 (none).
    const raw = new Uint8Array(height * (width * 4 + 1))
    for (let y = 0; y < height; y++) raw.set(pixels.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1)
    // 8 bits per channel, colour type 6 (RGBA), default compression, filter and interlace.
    const header = concat([u32(width), u32(height), Uint8Array.of(8, 6, 0, 0, 0)])
    return concat([PNG_SIGNATURE, chunk('IHDR', header), chunk('IDAT', zlibStored(raw)), chunk('IEND', new Uint8Array())])
}

function base64(bytes: Uint8Array): string {
    let s = ''
    for (const byte of bytes) s += String.fromCharCode(byte)
    return btoa(s)
}

/** The hex text of an `<ImageData>` as a PNG data URL; null when it is not a bitmap we can read. */
export function bitmapDataUrl(hex: string): string | null {
    const bytes = hexToBytes(hex)
    const image = bytes && decodeBmp(bytes)
    return image ? `data:image/png;base64,${base64(encodePng(image))}` : null
}

/**
 * Icons of one System Manager file: `iconOf(el)` gives the data URL of the image an item
 * references by `<ImageId>`, decoding each image once.
 */
export function fileImages(doc: Document): { iconOf: (el: Element) => string | undefined } {
    const hex = new Map<string, string>()
    for (const data of doc.getElementsByTagName('ImageData')) {
        const id = data.getAttribute('Id')
        if (id !== null && data.parentElement?.tagName === 'ImageDatas') hex.set(id, data.textContent ?? '')
    }
    const decoded = new Map<string, string | null>()
    return {
        iconOf: (el) => {
            const id = Array.from(el.children).find((c) => c.tagName === 'ImageId')?.textContent?.trim()
            if (!id || !hex.has(id)) return undefined
            if (!decoded.has(id)) decoded.set(id, bitmapDataUrl(hex.get(id)!))
            return decoded.get(id) ?? undefined
        },
    }
}

/** Icons of a source, deduplicated; undefined when there are none. */
export function sourceIcons(source: string | undefined, folders: Iterable<[prefix: string, icon: string | undefined]>): SourceIcons | undefined {
    const images: string[] = []
    const indexOf = (url: string) => {
        const at = images.indexOf(url)
        return at === -1 ? images.push(url) - 1 : at
    }
    const icons: SourceIcons = { images }
    if (source) icons.source = indexOf(source)
    for (const [prefix, icon] of folders) if (icon) (icons.folders ??= {})[prefix] = indexOf(icon)
    return images.length > 0 ? icons : undefined
}

/** The data URL of a tree folder's icon, if the file had one. */
export function folderIcon(source: { icons?: SourceIcons }, prefix: string): string | undefined {
    const at = source.icons?.folders?.[prefix]
    return at === undefined ? undefined : source.icons!.images[at]
}

/** The data URL of the source's own icon, if the file had one. */
export const sourceIcon = (source: { icons?: SourceIcons }): string | undefined =>
    source.icons?.source === undefined ? undefined : source.icons.images[source.icons.source]
