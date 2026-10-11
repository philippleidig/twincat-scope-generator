import JSZip from 'jszip'
import type { GeneratedProject } from './tcscopex'

/** Zip the generated `.tcscopex` files together with their `.tcmproj`. */
export async function createZipArchive(generated: GeneratedProject): Promise<Blob> {
    const zip = new JSZip()
    for (const file of generated.scopeFiles) zip.file(file.fileName, file.content)
    zip.file(generated.tcmproj.fileName, generated.tcmproj.content)
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
}

/** Offer a blob to the user as a file download. */
export function downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    // Revoke on the next tick: some browsers start the download asynchronously.
    setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function downloadText(content: string, fileName: string, type = 'application/json'): void {
    downloadBlob(new Blob([content], { type }), fileName)
}

/**
 * Whether the browser can hand a `.zip` to the OS share sheet (Mail, Outlook, Teams, …).
 * Safari on iOS/iPadOS/macOS can; Chromium only shares a fixed list of media and text
 * types, so there it stays false and the download is the only way out.
 */
export function canShareZip(): boolean {
    if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return false
    try {
        return navigator.canShare({ files: [new File([], 'probe.zip', { type: 'application/zip' })] })
    } catch {
        return false
    }
}

/**
 * Open the OS share sheet with the zip attached. Resolves false when the user closed the
 * sheet without sharing; rejects on any other failure.
 */
export async function shareZip(blob: Blob, fileName: string, title: string): Promise<boolean> {
    const file = new File([blob], fileName, { type: 'application/zip' })
    try {
        await navigator.share({ files: [file], title })
        return true
    } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return false
        throw e
    }
}
