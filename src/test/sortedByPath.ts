import { expect } from 'vitest'

/** Expects symbol paths in the search index's order: case-insensitively ascending, ties by exact path. */
export function expectSortedByPath(paths: string[]) {
    const unsorted = paths.findIndex((p, i) => {
        if (i === 0) return false
        const [a, b] = [paths[i - 1], p]
        const [la, lb] = [a.toLowerCase(), b.toLowerCase()]
        return la > lb || (la === lb && a > b)
    })
    expect(unsorted, `"${paths[unsorted - 1]}" before "${paths[unsorted]}"`).toBe(-1)
}
