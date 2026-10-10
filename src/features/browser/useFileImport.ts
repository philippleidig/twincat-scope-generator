import { useCallback } from 'react'
import { SUPPORTED_EXTENSIONS } from '@/catalog/importFile'
import { useCatalogStore } from '@/state/catalogStore'
import { useBrowserStore } from '@/state/browserStore'
import { toast } from '@/state/toastStore'

const isSupported = (name: string) => SUPPORTED_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext))

/** Read TwinCAT files (from a picker, a folder or a drop), import them and report the outcome. */
export function useFileImport() {
    const importFiles = useCatalogStore((s) => s.importFiles)

    return useCallback(
        async (fileList: Iterable<File>) => {
            const files = [...fileList]
            const supported = files.filter((f) => isSupported(f.name))
            if (supported.length === 0) {
                toast.warning(
                    files.length > 0 ? 'No .tmc, .xti or .tsproj files found in the selection.' : 'Nothing to import.',
                )
                return
            }
            const contents = await Promise.all(supported.map(async (f) => ({ name: f.webkitRelativePath || f.name, text: await f.text() })))
            const reports = importFiles(contents)
            const ok = reports.filter((r) => !r.error)
            const failed = reports.filter((r) => r.error)
            if (ok.length > 0) {
                const symbols = ok.reduce((n, r) => n + r.symbols, 0)
                toast.success(`Imported ${ok.length} file${ok.length === 1 ? '' : 's'} · ${symbols.toLocaleString()} symbols`)
                // Open the freshly imported sources so the user sees something right away.
                useBrowserStore.getState().expandSources(ok.flatMap((r) => r.sourceIds))
            }
            for (const r of failed) toast.warning(r.error!)
        },
        [importFiles],
    )
}
