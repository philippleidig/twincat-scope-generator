import { describe, it, expect } from 'vitest'
import {
    parseCounters,
    validateTemplate,
    generateCounterCombinations,
    expandTemplate,
    expandAllSymbols,
    calculateExpansionCount,
    formatCounterPlaceholder,
} from '@/lib/patterns'

describe('patternParser', () => {
    describe('parseCounters', () => {
        it('should parse a single counter with simplified syntax', () => {
            const result = parseCounters('MAIN.mover[{n:1:5}].data')
            expect(result).toHaveLength(1)
            expect(result[0]).toEqual({
                placeholder: '{n:1:5}',
                name: 'n',
                start: 1,
                end: 5,
            })
        })

        it('should parse multiple counters', () => {
            const result = parseCounters('Axis {x:1:10}.Drive {y:1:3}.Value')
            expect(result).toHaveLength(2)
            expect(result[0].name).toBe('x')
            expect(result[1].name).toBe('y')
        })

        it('should return empty array for no counters', () => {
            const result = parseCounters('MAIN.simple.path')
            expect(result).toHaveLength(0)
        })

        it('should handle counter with large numbers', () => {
            const result = parseCounters('Item[{idx:100:999}]')
            expect(result[0].start).toBe(100)
            expect(result[0].end).toBe(999)
        })
    })

    describe('validateTemplate', () => {
        it('should validate correct template', () => {
            const result = validateTemplate('MAIN.mover[{n:1:5}].data')
            expect(result.valid).toBe(true)
            expect(result.errors).toHaveLength(0)
        })

        it('should reject empty template', () => {
            const result = validateTemplate('')
            expect(result.valid).toBe(false)
            expect(result.errors).toContain('Template cannot be empty')
        })

        it('should reject mismatched braces', () => {
            const result = validateTemplate('MAIN.mover[{n:1:5].data')
            expect(result.valid).toBe(false)
            expect(result.errors).toContain('Mismatched braces in template')
        })

        it('should reject start > end', () => {
            const result = validateTemplate('MAIN[{n:10:5}]')
            expect(result.valid).toBe(false)
            expect(result.errors[0]).toContain('start (10) must be <= end (5)')
        })

        it('should allow same counter name used multiple times (uses same value)', () => {
            const result = validateTemplate('A[{n:1:5}].B[{n:1:3}]')
            expect(result.valid).toBe(true)
            expect(result.errors).toHaveLength(0)
        })
    })

    describe('generateCounterCombinations', () => {
        it('should generate combinations for single counter', () => {
            const combinations = generateCounterCombinations([
                { name: 'n', start: 1, end: 3 },
            ])
            expect(combinations).toHaveLength(3)
            expect(combinations[0].get('n')).toBe(1)
            expect(combinations[1].get('n')).toBe(2)
            expect(combinations[2].get('n')).toBe(3)
        })

        it('should generate Cartesian product for multiple counters', () => {
            const combinations = generateCounterCombinations([
                { name: 'x', start: 1, end: 2 },
                { name: 'y', start: 1, end: 3 },
            ])
            expect(combinations).toHaveLength(6) // 2 * 3

            // Check first and last combinations
            expect(combinations[0].get('x')).toBe(1)
            expect(combinations[0].get('y')).toBe(1)
            expect(combinations[5].get('x')).toBe(2)
            expect(combinations[5].get('y')).toBe(3)
        })

        it('should return single empty map for no counters', () => {
            const combinations = generateCounterCombinations([])
            expect(combinations).toHaveLength(1)
            expect(combinations[0].size).toBe(0)
        })
    })

    describe('expandTemplate', () => {
        it('should expand single counter', () => {
            const values = new Map([['n', 5]])
            const result = expandTemplate('MAIN.mover[{n:1:10}].data', values)
            expect(result).toBe('MAIN.mover[5].data')
        })

        it('should expand multiple counters', () => {
            const values = new Map([
                ['x', 2],
                ['y', 3],
            ])
            const result = expandTemplate(
                'Axis {x:1:5}.Drive {y:1:10}.Value',
                values
            )
            expect(result).toBe('Axis 2.Drive 3.Value')
        })

        it('should handle same counter appearing multiple times', () => {
            const values = new Map([['n', 7]])
            const result = expandTemplate(
                'Mover {n:1:10}.FB[{n:1:10}]',
                values
            )
            expect(result).toBe('Mover 7.FB[7]')
        })
    })

    describe('expandAllSymbols', () => {
        it('should expand all combinations', () => {
            const result = expandAllSymbols('Item[{n:1:3}]')
            expect(result).toEqual(['Item[1]', 'Item[2]', 'Item[3]'])
        })

        it('should return single item for no counters', () => {
            const result = expandAllSymbols('MAIN.simple.path')
            expect(result).toEqual(['MAIN.simple.path'])
        })

        it('should handle multiple counters', () => {
            const result = expandAllSymbols('A[{x:1:2}].B[{y:1:2}]')
            expect(result).toHaveLength(4)
            expect(result).toContain('A[1].B[1]')
            expect(result).toContain('A[1].B[2]')
            expect(result).toContain('A[2].B[1]')
            expect(result).toContain('A[2].B[2]')
        })
    })

    describe('calculateExpansionCount', () => {
        it('should return 1 for no counters', () => {
            expect(calculateExpansionCount('MAIN.simple')).toBe(1)
        })

        it('should calculate single counter range', () => {
            expect(calculateExpansionCount('A[{n:1:10}]')).toBe(10)
        })

        it('should calculate product of multiple counters', () => {
            expect(
                calculateExpansionCount('A[{x:1:5}].B[{y:1:3}]')
            ).toBe(15) // 5 * 3
        })

        it('should handle counter starting at 0', () => {
            expect(calculateExpansionCount('A[{n:0:9}]')).toBe(10)
        })

        it('should count same counter name only once (Mover Axis example)', () => {
            // Same counter {i:1:10} used twice = 10 acquisitions (not 100)
            expect(
                calculateExpansionCount('Mover Axis {i:1:10}.SoftDrive {i:1:10}.SdScopeVariable.ActPos')
            ).toBe(10)
        })
    })

    describe('formatCounterPlaceholder', () => {
        it('should format counter placeholder correctly', () => {
            expect(formatCounterPlaceholder('index', 1, 100)).toBe(
                '{index:1:100}'
            )
        })

        it('should handle single digit values', () => {
            expect(formatCounterPlaceholder('n', 0, 9)).toBe('{n:0:9}')
        })
    })

    describe('edge cases', () => {
        it('should handle counter with start equal to end (single value)', () => {
            const result = parseCounters('Item[{n:5:5}]')
            expect(result).toHaveLength(1)
            expect(result[0].start).toBe(5)
            expect(result[0].end).toBe(5)

            const expanded = expandAllSymbols('Item[{n:5:5}]')
            expect(expanded).toEqual(['Item[5]'])
            expect(calculateExpansionCount('Item[{n:5:5}]')).toBe(1)
        })

        it('should handle counter starting at 0', () => {
            const result = parseCounters('Array[{idx:0:3}]')
            expect(result[0].start).toBe(0)
            expect(result[0].end).toBe(3)

            const expanded = expandAllSymbols('Array[{idx:0:3}]')
            expect(expanded).toEqual(['Array[0]', 'Array[1]', 'Array[2]', 'Array[3]'])
        })

        it('should handle template with whitespace around counter', () => {
            const result = expandAllSymbols('Item[ {n:1:2} ].value')
            expect(result).toEqual(['Item[ 1 ].value', 'Item[ 2 ].value'])
        })

        it('should handle three counters (Cartesian product)', () => {
            const combinations = generateCounterCombinations([
                { name: 'a', start: 1, end: 2 },
                { name: 'b', start: 1, end: 2 },
                { name: 'c', start: 1, end: 2 },
            ])
            expect(combinations).toHaveLength(8) // 2 * 2 * 2
        })

        it('should validate negative values in counter range', () => {
            // Note: Current regex only matches positive numbers, so this is implicitly handled
            const result = validateTemplate('Item[{n:-1:5}]')
            // Regex won't match negative numbers, so it will be treated as no counters
            expect(result.valid).toBe(true)
            expect(parseCounters('Item[{n:-1:5}]')).toHaveLength(0)
        })

        it('should handle very large counter ranges', () => {
            const count = calculateExpansionCount('Item[{n:1:1000}]')
            expect(count).toBe(1000)
        })

        it('should handle multiple same-named counters with different ranges (first wins)', () => {
            const counters = parseCounters('A[{n:1:5}].B[{n:1:10}]')
            expect(counters).toHaveLength(1)
            expect(counters[0].start).toBe(1)
            expect(counters[0].end).toBe(5) // First occurrence defines range
        })

        it('should handle template with only counters', () => {
            const result = expandAllSymbols('{n:1:2}')
            expect(result).toEqual(['1', '2'])
        })

        it('should validate empty template', () => {
            const result = validateTemplate('   ')
            expect(result.valid).toBe(false)
            expect(result.errors).toContain('Template cannot be empty')
        })

        it('should validate template with only whitespace', () => {
            const result = validateTemplate('\t\n  ')
            expect(result.valid).toBe(false)
        })

        it('should handle special characters in template', () => {
            const result = expandAllSymbols('MAIN.data[{n:1:2}].value$test')
            expect(result).toEqual(['MAIN.data[1].value$test', 'MAIN.data[2].value$test'])
        })
    })
})
