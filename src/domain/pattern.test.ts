import { describe, expect, it } from 'vitest'
import { MAX_EXPANSION, expandTemplate, expansionCount, parseCounters, validateTemplate, wildcardsToTemplate } from './pattern'

describe('parseCounters', () => {
    it('returns unique counters in order; the first occurrence defines the range', () => {
        expect(parseCounters('A[{i:1:3}].B[{j:0:1}].C{i:1:3}')).toEqual([
            { name: 'i', start: 1, end: 3, width: 0 },
            { name: 'j', start: 0, end: 1, width: 0 },
        ])
    })
    it('detects zero padding from the start value', () => {
        expect(parseCounters('Axis_{n:01:12}')[0].width).toBe(2)
        expect(parseCounters('Axis_{n:0:12}')[0].width).toBe(0)
    })
    it('supports negative bounds', () => {
        expect(parseCounters('a[{i:-2:2}]')[0]).toMatchObject({ start: -2, end: 2 })
    })
})

describe('expansionCount', () => {
    it('is 1 for a plain symbol', () => expect(expansionCount('MAIN.x')).toBe(1))
    it('multiplies independent counters', () => expect(expansionCount('a[{i:1:4}].b[{j:1:8}]')).toBe(32))
    it('counts a repeated counter once', () => expect(expansionCount('Axis {i:1:10}.Drive {i:1:10}')).toBe(10))
})

describe('validateTemplate', () => {
    it('accepts plain paths and counters', () => {
        expect(validateTemplate('MAIN.fbAxis.fActPos').valid).toBe(true)
        expect(validateTemplate('MAIN.a[{i:1:5}]').valid).toBe(true)
    })
    it('rejects empty templates', () => {
        expect(validateTemplate('  ')).toEqual({ valid: false, errors: ['Symbol path is empty'] })
    })
    it('rejects malformed counters instead of exporting them literally', () => {
        expect(validateTemplate('MAIN.x[{i:1:5]').valid).toBe(false)
        expect(validateTemplate('MAIN.x[{i:1}]').valid).toBe(false)
    })
    it('rejects reversed ranges', () => {
        expect(validateTemplate('MAIN.item[{n:10:5}]').errors[0]).toMatch(/start \(10\) must be <= end \(5\)/)
    })
    it('rejects a counter reused with another range', () => {
        expect(validateTemplate('a{i:1:3}b{i:1:4}').errors).toContain('Counter "i" is used with different ranges')
    })
    it('caps the expansion size', () => {
        const r = validateTemplate('MAIN.x[{i:0:99999999}]')
        expect(r.valid).toBe(false)
        expect(r.errors[0]).toMatch(/limit/)
        expect(validateTemplate(`x{i:1:${MAX_EXPANSION}}`).valid).toBe(true)
    })
})

describe('expandTemplate', () => {
    it('expands the cartesian product, first counter slowest', () => {
        expect(expandTemplate('S[{s:1:2}].N[{n:1:2}]')).toEqual(['S[1].N[1]', 'S[1].N[2]', 'S[2].N[1]', 'S[2].N[2]'])
    })
    it('keeps repeated counters in sync', () => {
        expect(expandTemplate('Axis {i:1:2}.Drive {i:1:2}')).toEqual(['Axis 1.Drive 1', 'Axis 2.Drive 2'])
    })
    it('pads with zeros', () => {
        expect(expandTemplate('Axis_{i:08:10}')).toEqual(['Axis_08', 'Axis_09', 'Axis_10'])
    })
    it('returns the plain path unchanged', () => {
        expect(expandTemplate('MAIN.x')).toEqual(['MAIN.x'])
    })
    it('expands invalid templates to nothing', () => {
        expect(expandTemplate('MAIN.x[{i:5:1}]')).toEqual([])
    })
})

describe('wildcardsToTemplate', () => {
    it('turns wildcards into counters i, j, ...', () => {
        expect(
            wildcardsToTemplate('GVL.a[*].b[*,*].c', [
                { lower: 1, upper: 4 },
                { lower: 0, upper: 1 },
                { lower: 0, upper: 2 },
            ]),
        ).toBe('GVL.a[{i:1:4}].b[{j:0:1},{k:0:2}].c')
    })
    it('leaves wildcards without a range alone', () => {
        expect(wildcardsToTemplate('a[*]', [])).toBe('a[*]')
    })
})
