import type { ParsedCounter, Counter } from '@/types'

// Regex to match counter placeholders: {name:start:end}
const COUNTER_REGEX = /\{(\w+):(\d+):(\d+)\}/g

/**
 * Parse a symbol template and extract all UNIQUE counter definitions
 * Supports simplified syntax: {n:1:5} or {i:1:3}
 * When the same counter name appears multiple times, they share the same value
 */
export function parseCounters(template: string): ParsedCounter[] {
    const countersMap = new Map<string, ParsedCounter>()
    let match: RegExpExecArray | null

    // Reset regex state
    COUNTER_REGEX.lastIndex = 0

    while ((match = COUNTER_REGEX.exec(template)) !== null) {
        const name = match[1]
        // Only add if not already seen (first occurrence defines the range)
        if (!countersMap.has(name)) {
            countersMap.set(name, {
                placeholder: match[0],
                name: name,
                start: parseInt(match[2], 10),
                end: parseInt(match[3], 10),
            })
        }
    }

    return Array.from(countersMap.values())
}

/**
 * Validate counter syntax in a template
 */
export function validateTemplate(template: string): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!template.trim()) {
        errors.push('Template cannot be empty')
        return { valid: false, errors }
    }

    // Check for invalid counter syntax (unclosed braces, etc.)
    const openBraces = (template.match(/\{/g) || []).length
    const closeBraces = (template.match(/\}/g) || []).length

    if (openBraces !== closeBraces) {
        errors.push('Mismatched braces in template')
    }

    // Get unique counters
    const counters = parseCounters(template)

    // Check counter ranges
    for (const counter of counters) {
        if (counter.start > counter.end) {
            errors.push(`Counter "${counter.name}": start (${counter.start}) must be <= end (${counter.end})`)
        }
        if (counter.start < 0 || counter.end < 0) {
            errors.push(`Counter "${counter.name}": values must be non-negative`)
        }
    }

    return { valid: errors.length === 0, errors }
}

/**
 * Generate all counter value combinations for expansion
 */
export function generateCounterCombinations(counters: Counter[]): Map<string, number>[] {
    if (counters.length === 0) {
        return [new Map()]
    }

    const result: Map<string, number>[] = []

    function generate(index: number, current: Map<string, number>) {
        if (index === counters.length) {
            result.push(new Map(current))
            return
        }

        const counter = counters[index]
        for (let value = counter.start; value <= counter.end; value++) {
            current.set(counter.name, value)
            generate(index + 1, current)
        }
        current.delete(counter.name)
    }

    generate(0, new Map())
    return result
}

/**
 * Expand a template with counter values
 */
export function expandTemplate(template: string, values: Map<string, number>): string {
    let result = template

    for (const [name, value] of values) {
        // Replace all occurrences of this counter in the template
        const regex = new RegExp(`\\{${name}:\\d+:\\d+\\}`, 'g')
        result = result.replace(regex, value.toString())
    }

    return result
}

/**
 * Expand a template into all possible symbol names
 */
export function expandAllSymbols(template: string): string[] {
    const counters = parseCounters(template)
    const combinations = generateCounterCombinations(counters)
    return combinations.map((values) => expandTemplate(template, values))
}

/**
 * Calculate total number of expansions for a template
 * Same counter name used multiple times counts as ONE counter
 */
export function calculateExpansionCount(template: string): number {
    const counters = parseCounters(template)
    if (counters.length === 0) return 1

    return counters.reduce((total, counter) => {
        const count = counter.end - counter.start + 1
        return total * count
    }, 1)
}

/**
 * Format counter placeholder for display
 */
export function formatCounterPlaceholder(name: string, start: number, end: number): string {
    return `{${name}:${start}:${end}}`
}
