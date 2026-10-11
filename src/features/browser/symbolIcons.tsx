import { Ban, Boxes, Braces, Brackets, CornerDownRight, Cpu, EthernetPort, FileCode2, Folder, FolderOpen, Move3d, Variable } from 'lucide-react'
import type { SourceKind } from '@/catalog/model'
import type { BrowserNode } from '@/catalog/tree'

export function KindIcon({ kind, open = false }: { kind: BrowserNode['kind']; open?: boolean }) {
    const props = { size: 15, className: `kind-icon kind-icon--${kind}`, 'aria-hidden': true }
    switch (kind) {
        case 'folder':
            return open ? <FolderOpen {...props} /> : <Folder {...props} />
        case 'struct':
            return <Braces {...props} />
        case 'array':
            return <Brackets {...props} />
        case 'scalar':
            return <Variable {...props} />
        case 'pointer':
            return <CornerDownRight {...props} />
        default:
            return <Ban {...props} />
    }
}

export function SourceIcon({ kind, size = 16 }: { kind: SourceKind; size?: number }) {
    const props = { size, className: `source-icon source-icon--${kind}`, 'aria-hidden': true }
    switch (kind) {
        case 'PLC':
            return <Cpu {...props} />
        case 'NC':
            return <Move3d {...props} />
        case 'TcCOM':
            return <Boxes {...props} />
        case 'IO':
            return <EthernetPort {...props} />
        default:
            return <FileCode2 {...props} />
    }
}
