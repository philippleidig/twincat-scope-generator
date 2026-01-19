import { useState } from 'react'
import { EXAMPLE_PATTERNS } from '@/types'
import { CopyIcon, CheckIcon } from '@/components/ui'
import './ExamplePatterns.css'

export function ExamplePatterns() {
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

    const handleCopy = async (template: string, index: number) => {
        await navigator.clipboard.writeText(template)
        setCopiedIndex(index)
        setTimeout(() => setCopiedIndex(null), 2000)
    }

    return (
        <div className="example-patterns">
            <h3>Example Patterns</h3>
            <p className="example-hint">Example patterns for reference</p>
            <div className="examples-list">
                {EXAMPLE_PATTERNS.map((example, index) => (
                    <div key={index} className="example-item">
                        <div className="example-template">
                            <code>{example.template}</code>
                            <button
                                className={`copy-button ${copiedIndex === index ? 'copied' : ''}`}
                                onClick={() => handleCopy(example.template, index)}
                                title="Copy to clipboard"
                            >
                                {copiedIndex === index ? (
                                    <CheckIcon size={12} />
                                ) : (
                                    <CopyIcon size={12} />
                                )}
                            </button>
                        </div>
                        <span className="example-desc">{example.description}</span>
                    </div>
                ))}
            </div>
            <div className="syntax-help">
                <strong>Syntax:</strong> <code>{'{name:start:end}'}</code>
                <span className="syntax-example">e.g., <code>{'{i:1:5}'}</code> → 1, 2, 3, 4, 5</span>
            </div>
        </div>
    )
}
