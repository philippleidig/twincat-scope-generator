import React from 'react'
import './Input.css'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string
    error?: string
    helpText?: string
}

export function Input({
    label,
    error,
    helpText,
    className = '',
    id,
    ...props
}: InputProps) {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`

    return (
        <div className={`input-group ${className}`}>
            {label && (
                <label htmlFor={inputId} className="input-label">
                    {label}
                </label>
            )}
            <input
                id={inputId}
                className={`input ${error ? 'input-error' : ''}`}
                {...props}
            />
            {helpText && !error && (
                <span className="input-help">{helpText}</span>
            )}
            {error && <span className="input-error-text">{error}</span>}
        </div>
    )
}
