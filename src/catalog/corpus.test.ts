/**
 * Invariants over a corpus of real TwinCAT files (`scripts/corpus/manifest.json`).
 *
 * Run with `npm run test:corpus`, which fetches the corpus into `.corpus/` first; it has its own
 * config (`vitest.corpus.config.ts`) and is excluded from `npm test`, which stays fast and offline.
 * A missing or incomplete corpus fails the run. Checks invariants, not snapshots, and prints a
 * summary table at the end.
 */
import { existsSync, readFileSync } from 'node:fs'
import { afterAll, describe, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { MAX_EXPANSION, expansionCount, validateTemplate } from '@/domain/pattern'
import { NOTE } from './access'
import { importTwinCatFile } from './importFile'
import type { SymbolSource } from './model'
import { buildIndex, templateOf } from './search'
import { resolvePath } from './walk'
import { children, child, parseXml, properties, text } from './xml'

interface ManifestEntry {
    file: string
    kind: string
    license: string | null
}

const dir = resolve(process.cwd(), '.corpus')
const manifest: ManifestEntry[] = JSON.parse(readFileSync(resolve(process.cwd(), 'scripts/corpus/manifest.json'), 'utf8'))
const available = existsSync(dir) && manifest.every((m) => existsSync(resolve(dir, m.file)))

/** Resolve at most this many index entries per file (evenly spaced). */
const SAMPLE = 2_000
const KINDS = new Set(['PLC', 'TcCOM', 'NC', 'Other'])

const summary = {
    files: 0,
    importErrors: 0,
    sources: 0,
    roots: 0,
    entries: 0,
    scalars: 0,
    pointerPaths: 0,
    viaReference: 0,
    truncatedIndexes: 0,
    tooLarge: 0,
    invalidTemplates: 0,
    sampled: 0,
    unresolved: 0,
    hiddenLeaks: 0,
    disabled: new Map<string, number>(),
    ms: 0,
}

/** Paths of `<Symbol>`s the raw XML marks as having no ADS symbol (`hide`, `tc_no_symbol`). */
function hiddenSymbols(content: string): Set<string> {
    const out = new Set<string>()
    if (!content.includes('<Name>hide</Name>') && !content.includes('tc_no_symbol')) return out
    for (const s of parseXml(content).getElementsByTagName('Symbol')) {
        const p = properties(s)
        const noSymbol = p.get('tc_no_symbol')
        if (p.has('hide') || (noSymbol !== undefined && !noSymbol.startsWith('unused'))) out.add(text(s, 'Name').toLowerCase())
    }
    return out
}

/**
 * Members the raw XML marks as having no ADS symbol, per declaring type (upper-case):
 * `hide`, `tc_no_symbol` (without value) and implicit VAR_INST members. Read independently
 * of the importer so the check does not just repeat its logic — and deliberately narrower: it
 * does not cover locals under `hide_all_locals` (never present in the corpus) or empty arrays
 * (covered by the template check), and it matches members by declaring type name only.
 */
function hiddenMembers(content: string): Map<string, Set<string>> {
    const out = new Map<string, Set<string>>()
    if (!content.includes('hide') && !content.includes('tc_no_symbol') && !content.includes('implicit_inst_var')) return out
    const doc = parseXml(content)
    for (const dt of doc.getElementsByTagName('DataType')) {
        const names = new Set<string>()
        for (const s of children(dt, 'SubItem')) {
            const p = properties(s)
            if (p.has('hide') || p.has('implicit_inst_var') || (p.has('tc_no_symbol') && !p.get('tc_no_symbol'))) names.add(text(s, 'Name').toLowerCase())
        }
        if (names.size > 0) out.set((child(dt, 'Name')?.textContent ?? '').trim().toUpperCase(), names)
    }
    return out
}

const parentPath = (path: string) => {
    const dot = path.lastIndexOf('.')
    return dot > 0 && !path.endsWith(']') ? path.slice(0, dot) : null
}

function check(file: string, sources: SymbolSource[], content: string) {
    summary.sources += sources.length
    for (const s of sources) {
        expect(KINDS.has(s.kind), `${file}: kind ${s.kind}`).toBe(true)
        expect(Number.isInteger(s.port) && s.port > 0 && s.port < 65536, `${file}: port ${s.port}`).toBe(true)
        summary.roots += s.roots.length
    }
    const index = buildIndex(sources)
    if (index.truncated) summary.truncatedIndexes++
    summary.entries += index.entries.length
    const hidden = hiddenMembers(content)
    const hiddenRoots = hiddenSymbols(content)
    if (hiddenRoots.size > 0) {
        const leaks = index.entries.filter((e) => hiddenRoots.has(e.path.toLowerCase()))
        summary.hiddenLeaks += leaks.length
        expect(leaks.map((e) => e.path), `${file}: hidden symbols listed`).toEqual([])
    }
    const bySource = new Map(sources.map((s) => [s.id, s]))

    const step = Math.max(1, Math.ceil(index.entries.length / SAMPLE))
    index.entries.forEach((entry, i) => {
        if (entry.path.includes('^')) summary.pointerPaths++
        if (entry.warning?.includes(NOTE.viaReference)) summary.viaReference++
        if (entry.reason) {
            // One bucket for all "Static variable — record <FB>.<var>".
            const reason = entry.reason.replace(/^(Static variable — record ).+$/, '$1<FB type>.<var>')
            summary.disabled.set(reason, (summary.disabled.get(reason) ?? 0) + 1)
        }
        if (entry.kind === 'scalar') {
            summary.scalars++
            const template = templateOf(entry)
            if (!validateTemplate(template).valid) {
                summary.invalidTemplates++
                // The only accepted reason: an array too large to expand, which "Add" reports.
                expect(expansionCount(template), `${file}: invalid template ${template}`).toBeGreaterThan(MAX_EXPANSION)
                summary.tooLarge++
            }
        }
        if (i % step !== 0) return
        summary.sampled++
        const source = bySource.get(entry.sourceId)!
        const node = resolvePath(source, entry.path)
        if (!node) summary.unresolved++
        expect(node, `${file}: ${entry.path} does not resolve`).not.toBeNull()
        const parent = parentPath(entry.path)
        if (parent && hidden.size > 0) {
            const owner = resolvePath(source, parent)
            const names = owner && hidden.get(owner.resolved.typeName.toUpperCase())
            if (names?.has(entry.name.toLowerCase())) {
                summary.hiddenLeaks++
                expect.soft(false, `${file}: ${entry.path} is hidden in the file`).toBe(true)
            }
        }
    })
}

describe('real-file corpus', () => {
    it('is downloaded', () => {
        expect(available, 'run `npm run test:corpus` (or `node scripts/corpus/fetch.mjs`) to download .corpus/').toBe(true)
    })

    afterAll(() => {
        const rows: Array<[string, string | number]> = [
            ['files', summary.files],
            ['import errors', summary.importErrors],
            ['sources', summary.sources],
            ['roots', summary.roots],
            ['index entries', summary.entries],
            ['  scalar entries', summary.scalars],
            ['  pointer (^) paths', summary.pointerPaths],
            ['  via reference', summary.viaReference],
            ['truncated indexes', summary.truncatedIndexes],
            ['invalid templates', summary.invalidTemplates],
            [`  arrays > ${MAX_EXPANSION}`, summary.tooLarge],
            ['sampled paths', summary.sampled],
            ['  unresolved', summary.unresolved],
            ['  hidden leaks', summary.hiddenLeaks],
            ['time (s)', (summary.ms / 1000).toFixed(1)],
        ]
        const disabled = [...summary.disabled].sort((a, b) => b[1] - a[1])
        console.log(
            [
                'Corpus summary',
                ...rows.map(([k, v]) => `  ${k.padEnd(24)} ${typeof v === 'number' ? v.toLocaleString('en-US') : v}`),
                'Disabled entries by reason',
                ...disabled.map(([k, v]) => `  ${String(v).padStart(8)}  ${k}`),
            ].join('\n'),
        )
    })

    it.skipIf(!available).each(manifest.map((m) => [m.file, m] as const))('%s', (file) => {
        const t0 = performance.now()
        summary.files++
        const content = readFileSync(resolve(dir, file), 'utf8')
        let sources: SymbolSource[]
        try {
            sources = importTwinCatFile(file, content)
        } catch (e) {
            summary.importErrors++
            throw e
        }
        check(file, sources, content)
        summary.ms += performance.now() - t0
    })
})
