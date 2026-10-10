import type { ReactNode } from 'react'
import { useLayoutEffect, useRef, useState } from 'react'

interface VirtualListProps<T> {
    items: T[]
    rowHeight: number
    renderRow: (item: T, index: number) => ReactNode
    getKey: (item: T, index: number) => string
    className?: string
    /** Accessible role of the list container, e.g. "tree" or "listbox". */
    role?: string
    label?: string
    overscan?: number
}

/** Fixed-row-height windowing: only rows in (or near) the viewport are rendered. */
export function VirtualList<T>({ items, rowHeight, renderRow, getKey, className = '', role, label, overscan = 8 }: VirtualListProps<T>) {
    const ref = useRef<HTMLDivElement>(null)
    const [scrollTop, setScrollTop] = useState(0)
    const [height, setHeight] = useState(0)

    useLayoutEffect(() => {
        const el = ref.current
        if (!el) return
        setHeight(el.clientHeight)
        if (typeof ResizeObserver === 'undefined') return
        const observer = new ResizeObserver(() => setHeight(el.clientHeight))
        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    // Without layout (tests, first paint) render a reasonable first page.
    const viewport = height || rowHeight * 40
    const first = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
    const last = Math.min(items.length, Math.ceil((scrollTop + viewport) / rowHeight) + overscan)

    return (
        <div
            ref={ref}
            className={`vlist scroll ${className}`}
            role={role}
            aria-label={label}
            onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        >
            <div style={{ height: items.length * rowHeight, position: 'relative' }}>
                {items.slice(first, last).map((item, i) => (
                    <div
                        key={getKey(item, first + i)}
                        style={{ position: 'absolute', top: (first + i) * rowHeight, left: 0, right: 0, height: rowHeight }}
                    >
                        {renderRow(item, first + i)}
                    </div>
                ))}
            </div>
        </div>
    )
}
