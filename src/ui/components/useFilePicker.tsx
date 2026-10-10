import { useRef } from 'react'

interface FilePickerOptions {
    accept?: string
    multiple?: boolean
    /** Pick a whole folder (non-standard, supported by all current browsers). */
    directory?: boolean
    testId?: string
}

/** A hidden file input plus a function that opens it; the input is reset after each pick. */
export function useFilePicker(onFiles: (files: FileList) => void, { accept, multiple, directory, testId }: FilePickerOptions = {}) {
    const ref = useRef<HTMLInputElement>(null)
    const input = (
        <input
            ref={ref}
            type="file"
            accept={accept}
            multiple={multiple}
            hidden
            data-testid={testId}
            {...(directory ? { webkitdirectory: '', directory: '' } : {})}
            onChange={(e) => {
                if (e.target.files?.length) onFiles(e.target.files)
                e.target.value = ''
            }}
        />
    )
    return { open: () => ref.current?.click(), input }
}
