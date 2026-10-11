import { Ban, Braces, Brackets, CornerDownRight, Folder, FolderOpen, Variable } from 'lucide-react'
import type { SourceKind } from '@/catalog/model'
import type { BrowserNode } from '@/catalog/tree'
import deviceIcon from './icons/device.png'
import motionIcon from './icons/motion.png'
import plcIcon from './icons/plc.png'
import systemIcon from './icons/system.png'
import tccomIcon from './icons/tccom.png'

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

/** The Solution Explorer node of each runtime: PLC, MOTION, the I/O device, TcCOM Objects, SYSTEM. */
const SOURCE_ICON: Record<SourceKind, string> = { PLC: plcIcon, NC: motionIcon, IO: deviceIcon, TcCOM: tccomIcon, Other: systemIcon }

/** The icon of a source kind, or `src` — an icon the file brought along (`sourceIcon`). */
export function SourceIcon({ kind, src, size = 16 }: { kind: SourceKind; src?: string; size?: number }) {
    return <img className="source-icon" src={src ?? SOURCE_ICON[kind]} width={size} height={size} alt="" draggable={false} />
}

/** An icon from the imported file, e.g. an I/O box's, in place of the folder icon. */
export const FileIcon = ({ src }: { src: string }) => <img className="file-icon" src={src} width={16} height={16} alt="" draggable={false} />
