/**
 * I/O devices: the process image of an I/O device (EtherCAT master, PROFINET/PROFIBUS/CANopen
 * master, EtherNet/IP scanner, …) read by ADS symbol name (ADR 0006).
 *
 * With "Enable ADS Server" and "Create symbols" on the ADS tab of the device's *Image*, TwinCAT
 * serves the image on its own ADS port, 27904 + image id (`Device 1 › Image` with id 1 →
 * 27905). Its symbols are flat — every box at top level, whatever coupler it sits behind:
 *
 * - `Inputs` / `Outputs` of the device (EtherCAT: `Inputs.Frm0State`, `Outputs.Frm0Ctrl`, …);
 * - per box, one struct per *assigned* PDO (`<Pdo SyncMan="…">`): `Term 2 (EL3102).AI Standard
 *   Channel 1.Value`; entry names split at `__` into nested structs (`Status__Error` →
 *   `Status.Error`), unnamed entries and `X__` are padding;
 * - per EtherCAT box with process data `WcState` (and `InputToggle` with inputs), BOOL.
 *
 * Verified against the symbol table TwinCAT downloaded to such an image (a `_Boot` folder in a
 * public project); boxes of other fieldbuses follow the same pattern but are not verified yet.
 * A device with several images (one per task accessing it) puts boxes linked to the NC into the
 * first image and the rest into the second, as in that project.
 */
import type { AreaKind, MemberDef, SymbolRoot, SymbolSource, TypeTable } from './model'
import { sourceIcons } from './bitmap'
import { finalizeSource, readTypeRef, withSymbols } from './typeTable'
import { child, children, text } from './xml'

/** `0x6D00`: an image with id n is served on port 27904 + n. */
export const IO_IMAGE_PORT_BASE = 27904

/** `<Image ImageFlags>` bits set when "Enable ADS Server" and "Create symbols" are checked. */
const IMAGE_ADS_SYMBOLS = 0x30

const ETHERCAT_DEVICE = '111'

/** Device-level variables TwinCAT adds to the image of every EtherCAT master (not in the file). */
const ETHERCAT_DEVICE_VARS: Array<{ name: string; area: AreaKind }> = [
    { name: 'Inputs.Frm0State', area: 'input' },
    { name: 'Inputs.Frm0WcState', area: 'input' },
    { name: 'Inputs.Frm0InputToggle', area: 'input' },
    { name: 'Outputs.Frm0Ctrl', area: 'output' },
    { name: 'Outputs.Frm0WcCtrl', area: 'output' },
]

export const IO_NOTE = {
    module: 'Path below a module of a modular box is not verified yet',
} as const

export const IO_HINT =
    'I/O symbols exist only with "Enable ADS Server" and "Create symbols" on the ADS tab of the device\'s Image; the port is 27904 + the image id. Keep "Generate hierarchical symbol names" off.'

type Base = (index: number) => Pick<SymbolSource, 'id' | 'fileName' | 'types' | 'amsNetId'>

/** The icon an item references by `<ImageId>`, as a data URL (`fileImages`). */
type IconOf = (el: Element) => string | undefined

const intAttr = (el: Element, name: string): number | null => {
    const raw = el.getAttribute(name)?.trim() ?? ''
    const n = raw.startsWith('#x') ? Number.parseInt(raw.slice(2), 16) : Number.parseInt(raw, 10)
    return Number.isFinite(n) ? n : null
}

const isDisabled = (el: Element) => el.getAttribute('Disabled') === 'true'

/** The `<Name>` of a tree item; `__FILENAME__` stands for the file's own name. */
const itemName = (el: Element, fileStem: string) => {
    const name = text(el, 'Name')
    return name === '__FILENAME__' ? fileStem : name
}

// ---------------------------------------------------------------------------
// PDO entries → struct types
// ---------------------------------------------------------------------------

interface Group {
    /** Members in declaration order: an entry or a nested group. */
    items: Map<string, { entry?: { type: string; ns?: string; comment?: string }; group?: Group; dims?: { lower: number; upper: number } }>
}

const ARRAY_ELEMENT = /^ARRAY \[(-?\d+)\]$/

/** Builds struct types for PDOs, named like TwinCAT does (`Channel 1_TYPE`), one per distinct layout. */
class TypeBuilder {
    private signatures = new Map<string, string>()

    constructor(readonly types: TypeTable) {}

    /** Register the struct for `group` under `<name>_TYPE` (suffixed when that name is taken by another layout). */
    register(name: string, group: Group): string {
        const members: MemberDef[] = []
        for (const [memberName, item] of group.items) {
            if (item.group) {
                members.push({ name: memberName, type: this.register(memberName, item.group) })
            } else if (item.entry) {
                const member: MemberDef = { name: memberName, type: item.entry.type }
                if (item.entry.ns) member.ns = item.entry.ns
                if (item.dims) member.dims = [item.dims]
                if (item.entry.comment) member.comment = item.entry.comment
                members.push(member)
            }
        }
        const signature = JSON.stringify(members.map((m) => [m.name, m.type, m.dims]))
        const base = `${name}_TYPE`
        for (let n = 1; ; n++) {
            const typeName = n === 1 ? base : `${base} (${n})`
            const key = typeName.toUpperCase()
            const known = this.signatures.get(key)
            if (known === signature) return typeName
            if (known === undefined && !this.types[key]) {
                this.signatures.set(key, signature)
                this.types[key] = { kind: 'struct', name: typeName, members: withSymbols(this.types, members) }
                return typeName
            }
        }
    }
}

/**
 * The entries of a PDO as a tree: `Status__Underrange` → Status › Underrange, `Samples__ARRAY [3]`
 * → array `Samples`. Unnamed entries and names ending in `__` are padding without a symbol.
 */
function entryGroup(pdo: Element): Group {
    const root: Group = { items: new Map() }
    for (const entry of children(pdo, 'Entry')) {
        const name = entry.getAttribute('Name') ?? ''
        const parts = name.split('__')
        if (!name || parts.some((p) => p === '')) continue
        const typeEl = child(entry, 'Type')
        const { type, ns } = readTypeRef(entry, typeEl)
        if (!type) continue
        const comment = text(entry, 'Comment') || undefined
        let group = root
        const element = ARRAY_ELEMENT.exec(parts[parts.length - 1])
        const path = element ? parts.slice(0, -1) : parts
        for (const segment of path.slice(0, -1)) {
            let item = group.items.get(segment)
            if (!item) group.items.set(segment, (item = { group: { items: new Map() } }))
            if (!item.group) break
            group = item.group
        }
        const last = path[path.length - 1]
        const existing = group.items.get(last)
        if (element) {
            const index = Number(element[1])
            if (!existing) group.items.set(last, { entry: { type, ns, comment }, dims: { lower: index, upper: index } })
            else if (existing.dims) existing.dims = { lower: Math.min(existing.dims.lower, index), upper: Math.max(existing.dims.upper, index) }
        } else if (!existing) {
            group.items.set(last, { entry: { type, ns, comment } })
        }
    }
    return root
}

// ---------------------------------------------------------------------------
// Boxes
// ---------------------------------------------------------------------------

/** What a box contributes to the image, before it is assigned to one. */
interface BoxSymbols {
    /** Tree path below the device, as used by `<Mappings>` (`Term 1 (EK1100)^Term 2 (EL1008)`). */
    treePath: string
    /** Box name: the first segment of its roots, so the tree shows it as a folder. */
    name: string
    roots: SymbolRoot[]
    icon?: string
}

/** Roots of an EtherCAT box: one struct per assigned PDO, plus `WcState`/`InputToggle`. */
function etherCatBoxRoots(ecat: Element, boxName: string, types: TypeBuilder): SymbolRoot[] {
    const roots: SymbolRoot[] = []
    // PDOs of a module (`<Slot><Module><PdoIndex>`) are listed below the module's name.
    const moduleOf = new Map<number, string>()
    for (const slot of children(ecat, 'Slot')) {
        for (const module of children(slot, 'Module')) {
            const moduleName = text(module, 'Name')
            for (const idx of children(module, 'PdoIndex')) moduleOf.set(Number.parseInt(idx.textContent ?? '', 10), moduleName)
        }
    }
    let inputs = false
    for (const pdo of children(ecat, 'Pdo')) {
        // Only PDOs assigned to a sync manager are exchanged (and get a symbol).
        if (pdo.getAttribute('SyncMan') === null) continue
        const pdoName = pdo.getAttribute('Name') ?? ''
        if (!pdoName) continue
        const area: AreaKind = pdo.getAttribute('InOut') === '1' ? 'output' : 'input'
        const group = entryGroup(pdo)
        if (group.items.size === 0) continue
        if (area === 'input') inputs = true
        const module = moduleOf.get(intAttr(pdo, 'Index') ?? -1)
        const name = module ? `${boxName}.${module}.${pdoName}` : `${boxName}.${pdoName}`
        const areaName = area === 'input' ? 'Inputs' : 'Outputs'
        const [only] = group.items
        let root: SymbolRoot
        if (group.items.size === 1 && only[0] === pdoName && only[1].entry && !only[1].dims) {
            // A PDO whose one entry has its name is a single value (`Term 5 (EL3702).Ch1 CycleCount`).
            const { type, ns, comment } = only[1].entry
            root = { name, type, area, areaName }
            if (ns) root.ns = ns
            if (comment) root.comment = comment
        } else {
            root = { name, type: types.register(pdoName, group), area, areaName }
        }
        if (module) root.note = IO_NOTE.module
        roots.push(root)
    }
    if (roots.length > 0) {
        roots.push({ name: `${boxName}.WcState`, type: 'BOOL', area: 'input', areaName: 'WcState', comment: 'Working counter state of the box (TRUE = invalid)', system: true })
        if (inputs) roots.push({ name: `${boxName}.InputToggle`, type: 'BOOL', area: 'input', areaName: 'WcState', system: true })
    }
    return roots
}

const varGroupArea = (vars: Element): AreaKind =>
    vars.getAttribute('VarGrpType') === '1' ? 'input' : vars.getAttribute('VarGrpType') === '2' ? 'output' : 'internal'

/** `<Vars>` groups of a tree item as `<prefix><group>.<var>`. */
function varsRoots(owner: Element, prefix: string): SymbolRoot[] {
    const roots: SymbolRoot[] = []
    for (const vars of children(owner, 'Vars')) {
        const groupName = text(vars, 'Name') || 'Vars'
        for (const v of children(vars, 'Var')) {
            const name = text(v, 'Name')
            const { type, ns, dims } = readTypeRef(v, child(v, 'Type') ?? child(v, 'BaseType'))
            if (!name || !type) continue
            roots.push({ name: `${prefix}${groupName}.${name}`, type, ns, dims, area: varGroupArea(vars), areaName: groupName, comment: text(v, 'Comment') || undefined })
        }
    }
    return roots
}

/**
 * Variables of a non-EtherCAT box: its own `<Vars>` and those of named sub-items in the protocol
 * section (PROFIBUS modules, EtherNet/IP connections, …), `<box>.<item>.<group>.<var>`.
 */
function fieldbusBoxRoots(box: Element, boxName: string): SymbolRoot[] {
    const roots = varsRoots(box, `${boxName}.`)
    const visit = (el: Element, prefix: string) => {
        for (const c of el.children) {
            if (c.tagName === 'Box' || c.tagName === 'Vars') continue
            const name = text(c, 'Name')
            const next = name && children(c, 'Vars').length > 0 ? `${prefix}${name}.` : prefix
            if (name) roots.push(...varsRoots(c, next))
            visit(c, name ? next : prefix)
        }
    }
    for (const c of box.children) if (c.tagName !== 'Box' && c.tagName !== 'Vars' && c.tagName !== 'EtherCAT') visit(c, `${boxName}.`)
    return roots
}

/** Every enabled box below `parent` (depth first), with its roots. */
function collectBoxes(parent: Element, parentPath: string, fileStem: string, types: TypeBuilder, iconOf: IconOf, out: BoxSymbols[]): void {
    for (const box of children(parent, 'Box')) {
        if (box.getAttribute('File') || isDisabled(box)) continue
        const name = itemName(box, fileStem)
        if (!name) continue
        const treePath = parentPath ? `${parentPath}^${name}` : name
        const ecat = child(box, 'EtherCAT')
        out.push({ treePath, name, roots: ecat ? etherCatBoxRoots(ecat, name, types) : fieldbusBoxRoots(box, name), icon: iconOf(box) })
        collectBoxes(box, treePath, fileStem, types, iconOf, out)
    }
}

/** Folder icons of the boxes that have roots here. */
const boxIcons = (boxes: BoxSymbols[]) => boxes.filter((b) => b.roots.length > 0).map((b): [string, string | undefined] => [b.name, b.icon])

// ---------------------------------------------------------------------------
// Devices and images
// ---------------------------------------------------------------------------

/**
 * Tree paths of the boxes linked to the NC: a `<Mappings>` owner pair `TINC^…` ↔
 * `TIID^<device>^<box path>[^<item>]`, matched to the deepest box on that path.
 */
function ncLinkedBoxes(doc: Document, deviceName: string, boxes: BoxSymbols[]): Set<string> {
    const linked = new Set<string>()
    const prefix = `TIID^${deviceName}^`
    const paths = new Set(boxes.map((b) => b.treePath))
    for (const a of doc.getElementsByTagName('OwnerA')) {
        for (const b of children(a, 'OwnerB')) {
            const pair = [a.getAttribute('Name') ?? '', b.getAttribute('Name') ?? '']
            const io = pair.find((n) => n.startsWith(prefix))
            if (!io || !pair.some((n) => n.startsWith('TINC^'))) continue
            const parts = io.slice(prefix.length).split('^')
            for (let n = parts.length; n > 0; n--) {
                const path = parts.slice(0, n).join('^')
                if (paths.has(path)) {
                    linked.add(path)
                    break
                }
            }
        }
    }
    return linked
}

const imageAdsEnabled = (image: Element) => ((intAttr(image, 'ImageFlags') ?? 0) & IMAGE_ADS_SYMBOLS) === IMAGE_ADS_SYMBOLS

/** One source per process image of an I/O device. */
function deviceSources(doc: Document, device: Element, fileStem: string, builder: TypeBuilder, iconOf: IconOf, base: Base, firstIndex: number): SymbolSource[] {
    const images = children(device, 'Image')
    if (images.length === 0) return []
    const deviceName = itemName(device, fileStem) || `Device ${device.getAttribute('Id') ?? ''}`.trim()
    const ethercat = device.getAttribute('DevType') === ETHERCAT_DEVICE

    const deviceRoots: SymbolRoot[] = ethercat
        ? ETHERCAT_DEVICE_VARS.map(({ name, area }) => ({ name, type: 'UINT', area, areaName: area === 'input' ? 'Inputs' : 'Outputs', system: true }))
        : varsRoots(device, '')
    const boxes: BoxSymbols[] = []
    collectBoxes(device, '', fileStem, builder, iconOf, boxes)

    // Several images: one per task accessing the device; boxes go where their variables are linked.
    const perImage: SymbolRoot[][] = images.map(() => [])
    const boxesPerImage: BoxSymbols[][] = images.map(() => [])
    perImage[0].push(...deviceRoots)
    const nc = images.length > 1 ? ncLinkedBoxes(doc, deviceName, boxes) : new Set<string>()
    const split = nc.size > 0
    for (const box of boxes) {
        const i = !split || nc.has(box.treePath) ? 0 : 1
        perImage[i].push(...box.roots)
        boxesPerImage[i].push(box)
    }

    const sources: SymbolSource[] = []
    images.forEach((image, i) => {
        const roots = finalizeSource(builder.types, perImage[i])
        if (roots.length === 0) return
        const imageName = text(image, 'Name') || 'Image'
        const id = intAttr(image, 'Id')
        const warnings: string[] = []
        if (isDisabled(device)) warnings.push('The device is disabled in this configuration, so its image has no symbols.')
        if (!imageAdsEnabled(image)) {
            warnings.push(`The ADS server of "${deviceName} › ${imageName}" is not enabled in this file: enable "ADS Server" and "Create symbols" on its ADS tab, or these symbols do not exist on the target.`)
        }
        if (images.length > 1) {
            warnings.push(
                split
                    ? `This device has ${images.length} process images (one per task); boxes linked to the NC are listed under the first, all others under the second. Check the port if a box is linked differently.`
                    : `This device has ${images.length} process images (one per task); without links in this file every box is listed under the first. Boxes in another image need that image's port.`,
            )
        }
        if (!ethercat && boxes.some((b) => b.roots.length > 0)) warnings.push('Symbol paths of boxes on this fieldbus are not verified yet; compare with the Target Browser.')
        warnings.push(IO_HINT)
        sources.push({
            ...base(firstIndex + sources.length),
            kind: 'IO',
            title: images.length > 1 ? `${deviceName} · ${imageName}` : deviceName,
            pathPrefix: '',
            port: id !== null && id > 0 ? IO_IMAGE_PORT_BASE + id : IO_IMAGE_PORT_BASE + 1,
            roots,
            complete: true,
            warnings,
            icons: sourceIcons(undefined, boxIcons(boxesPerImage[i])),
        })
    })
    return sources
}

/**
 * I/O sources of a System Manager file: every `<Device>` with a process image, and boxes exported
 * on their own (`.xti` of a terminal), whose device and port the file does not know.
 */
export function readIoSources(doc: Document, fileStem: string, base: Base, firstIndex: number, iconOf: IconOf = () => undefined): SymbolSource[] {
    const sources: SymbolSource[] = []
    // One type table per file: equal PDO layouts share a type across devices.
    const builder = new TypeBuilder(base(firstIndex).types)
    for (const device of doc.getElementsByTagName('Device')) {
        if (device.getAttribute('File')) continue
        sources.push(...deviceSources(doc, device, fileStem, builder, iconOf, base, firstIndex + sources.length))
    }
    const root = doc.documentElement
    if (root.tagName === 'TcSmItem') {
        const boxes: BoxSymbols[] = []
        collectBoxes(root, '', fileStem, builder, iconOf, boxes)
        const roots = finalizeSource(builder.types, boxes.flatMap((b) => b.roots))
        if (roots.length > 0) {
            sources.push({
                ...base(firstIndex + sources.length),
                kind: 'IO',
                title: boxes[0].treePath,
                pathPrefix: '',
                port: IO_IMAGE_PORT_BASE + 1,
                roots,
                complete: true,
                warnings: [
                    "This file holds a box without its device: set the port to the one of the device's image (27904 + image id, 27905 for the first).",
                    IO_HINT,
                ],
                icons: sourceIcons(boxes[0].icon, boxIcons(boxes)),
            })
        }
    }
    return sources
}
