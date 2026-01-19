import React from 'react'
import './Select.css'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string
    options: { value: string; label: string }[]
    error?: string
}

export function Select({
    label,
    options,
    error,
    className = '',
    id,
    ...props
}: SelectProps) {
    const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`

    return (
        <div className={`select-group ${className}`}>
            {label && (
                <label htmlFor={selectId} className="select-label">
                    {label}
                </label>
            )}
            <select
                id={selectId}
                className={`select ${error ? 'select-error' : ''}`}
                {...props}
            >
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
            {error && <span className="select-error-text">{error}</span>}
        </div>
    )
}
