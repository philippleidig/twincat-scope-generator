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
