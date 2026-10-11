/**
 * Symbol templates with counters.
 *
 * A template is a symbol path that may contain counters `{name:start:end}`, e.g.
 * `MAIN.mover[{i:1:5}].fActPos`. Expanding it yields one symbol per counter value
 * (the cartesian product when several counters are used). Repeating a counter name
 * reuses the same value, so `Axis {i:1:3}.Enc {i:1:3}` expands to 3 symbols, not 9.
 *
 * A start value with leading zeros sets a fixed width: `{i:01:12}` → 01 … 12.
 */

export interface Counter {
    name: string
    start: number
    end: number
    /** Zero-padded width, or 0 for no padding. */
    width: number
}

export interface TemplateValidation {
    valid: boolean
    errors: string[]
}

/** Hard cap per template so a typo like `{i:0:9999999}` cannot freeze the browser. */
export const MAX_EXPANSION = 5_000

const COUNTER = /\{(\w+):(-?\d+):(-?\d+)\}/g

/**
 * A reference to a counter without its range, `{i}`: how display names insert counter values.
 * Group 1 is the counter name.
 */
export const COUNTER_REF = /\{(\w+)\}/g

/** True when `text` contains a counter with its range (`{i:1:4}`). */
export const hasCounterDefinition = (text: string): boolean => text.search(COUNTER) !== -1

/** Unique counters in order of first appearance; the first occurrence defines the range. */
export function parseCounters(template: string): Counter[] {
    const counters = new Map<string, Counter>()
    for (const m of template.matchAll(COUNTER)) {
        const [, name, start, end] = m
        if (counters.has(name)) continue
        counters.set(name, {
            name,
            start: Number(start),
            end: Number(end),
            width: start.length > 1 && start.startsWith('0') ? start.length : 0,
        })
    }
    return [...counters.values()]
}

/** Number of symbols the template expands to (1 for a plain symbol path). */
export function expansionCount(template: string): number {
    return parseCounters(template).reduce((n, c) => n * Math.max(0, c.end - c.start + 1), 1)
}

export function validateTemplate(template: string): TemplateValidation {
    const errors: string[] = []
    if (!template.trim()) return { valid: false, errors: ['Symbol path is empty'] }

    const withoutCounters = template.replace(COUNTER, '')
    if (/[{}]/.test(withoutCounters)) {
        errors.push('Invalid counter: use {name:start:end}, e.g. {i:1:10}')
    }

    const counters = parseCounters(template)
    for (const c of counters) {
        if (c.start > c.end) errors.push(`Counter "${c.name}": start (${c.start}) must be <= end (${c.end})`)
    }
    for (const m of template.matchAll(COUNTER)) {
        const first = counters.find((c) => c.name === m[1])!
        if (Number(m[2]) !== first.start || Number(m[3]) !== first.end) {
            errors.push(`Counter "${m[1]}" is used with different ranges`)
            break
        }
    }

    if (errors.length === 0) {
        const count = expansionCount(template)
        if (count > MAX_EXPANSION) {
            errors.push(`Expands to ${count.toLocaleString('en-US')} symbols (limit ${MAX_EXPANSION.toLocaleString('en-US')})`)
        }
    }
    return { valid: errors.length === 0, errors }
}

function format(value: number, width: number): string {
    return width > 0 ? String(value).padStart(width, '0') : String(value)
}

/** One expansion of a template: the symbol path and the (formatted) value of each counter. */
export interface Expansion {
    symbol: string
    values: ReadonlyMap<string, string>
}

/** The counter values of expansion `index` (mixed radix: the last counter varies fastest). */
function valuesAt(counters: Counter[], index: number): Map<string, string> {
    const values = new Map<string, string>()
    let rest = index
    for (let i = counters.length - 1; i >= 0; i--) {
        const c = counters[i]
        const n = c.end - c.start + 1
        values.set(c.name, format(c.start + (rest % n), c.width))
        rest = Math.floor(rest / n)
    }
    return values
}

const expansion = (template: string, values: Map<string, string>): Expansion => ({
    symbol: template.replace(COUNTER, (_, name: string) => values.get(name)!),
    values,
})

/**
 * Every expansion of a template, in counter order (first counter varies slowest).
 * Callers must validate first; an invalid template expands to nothing.
 */
export function expandTemplateValues(template: string): Expansion[] {
    if (!validateTemplate(template).valid) return []
    const counters = parseCounters(template)
    return Array.from({ length: expansionCount(template) }, (_, i) => expansion(template, valuesAt(counters, i)))
}

/** Expansion `index` alone (without expanding the rest); null for an invalid template or index. */
export function expansionAt(template: string, index: number): Expansion | null {
    if (!validateTemplate(template).valid || index < 0 || index >= expansionCount(template)) return null
    return expansion(template, valuesAt(parseCounters(template), index))
}

/** All symbol paths a template expands to (see `expandTemplateValues`). */
export function expandTemplate(template: string): string[] {
    return expandTemplateValues(template).map((e) => e.symbol)
}

const COUNTER_NAMES = ['i', 'j', 'k', 'l', 'm', 'n']

/**
 * Turn a path with array wildcards into a template, e.g.
 * `MAIN.aAxis[*].fPos` with dims [[1,10]] → `MAIN.aAxis[{i:1:10}].fPos`.
 * Multi-dimensional wildcards `[*,*]` consume one range per `*`.
 */
export function wildcardsToTemplate(path: string, ranges: ReadonlyArray<{ lower: number; upper: number }>): string {
    let n = 0
    return path.replace(/\*/g, () => {
        const r = ranges[n]
        const name = COUNTER_NAMES[n] ?? `c${n}`
        n++
        return r ? `{${name}:${r.lower}:${r.upper}}` : '*'
    })
}
