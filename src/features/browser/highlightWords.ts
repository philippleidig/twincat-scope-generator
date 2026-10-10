/** Plain words of a query (no `field:` filters, no wildcards), lower-cased. */
export function highlightWords(query: string): string[] {
    return query
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w && !w.includes(':'))
        .flatMap((w) => w.split(/[*?]/))
        .filter((w) => w.length > 0)
}
