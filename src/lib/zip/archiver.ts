import JSZip from 'jszip'
import type { GenerationResult } from '@/types'

/**
 * Create a ZIP archive containing all generated files
 */
export async function createZipArchive(result: GenerationResult): Promise<Blob> {
    const zip = new JSZip()

    // Add all tcscopex files
    for (const file of result.tcscopexFiles) {
        zip.file(file.fileName, file.content)
    }

    // Add tcmproj file
    zip.file(result.tcmprojFileName, result.tcmprojContent)

    // Generate ZIP blob
    return await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: {
            level: 6,
        },
    })
}

/**
 * Trigger download of a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}

/**
 * Download a single file as text
 */
export function downloadTextFile(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'application/xml' })
    downloadBlob(blob, filename)
}
