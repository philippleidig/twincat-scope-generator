import { useState } from 'react'
import { Button, DownloadIcon } from '@/components/ui'
import { useConfigStore } from '@/stores/configStore'
import { generateAllFiles } from '@/lib/xml'
import { createZipArchive, downloadBlob } from '@/lib/zip'
import { validateTemplate } from '@/lib/patterns'
import './DownloadButton.css'

export function DownloadButton() {
    const { globalSettings, scopeFiles } = useConfigStore()
    const [isGenerating, setIsGenerating] = useState(false)
    const [error, setError] = useState<string | null>(null)



    // Validate all patterns
    const hasValidPatterns = scopeFiles.some((file) =>
        file.patterns.some((pattern) =>
            pattern.symbols.some((symbol) => {
                if (!symbol.template.trim()) return false
                const validation = validateTemplate(symbol.template)
                return validation.valid
            })
        )
    )

    const handleDownload = async () => {
        if (!hasValidPatterns) return

        setIsGenerating(true)
        setError(null)

        try {
            // Generate all files
            const result = generateAllFiles(globalSettings, scopeFiles)

            // Create ZIP archive
            const zipBlob = await createZipArchive(result)

            // Download
            const zipFileName = `${globalSettings.projectName.replace(/\s+/g, '_')}_scope_config.zip`
            downloadBlob(zipBlob, zipFileName)
        } catch (err) {
            console.error('Generation failed:', err)
            setError(err instanceof Error ? err.message : 'Failed to generate files')
        } finally {
            setIsGenerating(false)
        }
    }



    return (
        <div className="download-section">

            <Button
                size="lg"
                onClick={handleDownload}
                disabled={!hasValidPatterns || isGenerating}
                className="download-button"
            >
                {isGenerating ? (
                    <>
                        <span className="spinner" />
                        Generating...
                    </>
                ) : (
                    <>
                        <DownloadIcon size={18} /> Download ZIP
                    </>
                )}
            </Button>

            {!hasValidPatterns && (
                <p className="download-hint">
                    Add symbols to enable download
                </p>
            )}

            {error && <p className="download-error">{error}</p>}
        </div>
    )
}
