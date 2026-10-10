import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { useId } from 'react'
import { useNumberDraft } from './useNumberDraft'

interface FieldShellProps {
    label: string
    hideLabel?: boolean
    hint?: ReactNode
    error?: string | null
    id: string
    children: ReactNode
    className?: string
}

function FieldShell({ label, hideLabel, hint, error, id, children, className = '' }: FieldShellProps) {
    return (
        <div className={`field ${error ? 'field--error' : ''} ${className}`}>
            <label htmlFor={id} className={hideLabel ? 'sr-only' : 'field__label'}>
                {label}
            </label>
            {children}
            {error ? (
                <span id={`${id}-msg`} className="field__error" role="alert">
                    {error}
                </span>
            ) : hint ? (
                <span id={`${id}-msg`} className="field__hint">
                    {hint}
                </span>
            ) : null}
        </div>
    )
}

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
    label: string
    hideLabel?: boolean
    hint?: ReactNode
    error?: string | null
    mono?: boolean
    suffix?: ReactNode
    fieldClassName?: string
}

export function TextField({ label, hideLabel, hint, error, mono, suffix, fieldClassName, className = '', ...rest }: TextFieldProps) {
    const id = useId()
    return (
        <FieldShell label={label} hideLabel={hideLabel} hint={hint} error={error} id={id} className={fieldClassName}>
            <div className="input-wrap">
                <input
                    id={id}
                    aria-invalid={!!error}
                    aria-describedby={error || hint ? `${id}-msg` : undefined}
                    className={`input ${mono ? 'mono' : ''} ${className}`}
                    {...rest}
                />
                {suffix && <span className="input-suffix">{suffix}</span>}
            </div>
        </FieldShell>
    )
}

export interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
    label: string
    hideLabel?: boolean
    hint?: ReactNode
    options: Array<{ value: string; label: string }>
    fieldClassName?: string
}

export function SelectField({ label, hideLabel, hint, options, fieldClassName, className = '', ...rest }: SelectFieldProps) {
    const id = useId()
    return (
        <FieldShell label={label} hideLabel={hideLabel} hint={hint} id={id} className={fieldClassName}>
            <select id={id} className={`input select ${className}`} {...rest}>
                {options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
        </FieldShell>
    )
}

export interface NumberFieldProps extends Omit<TextFieldProps, 'value' | 'onChange' | 'type'> {
    value: number
    onValueChange: (n: number) => void
}

/** Numeric text field that can be cleared and retyped without fighting the user. */
export function NumberField({ value, onValueChange, ...rest }: NumberFieldProps) {
    return <TextField {...rest} {...useNumberDraft(value, onValueChange)} />
}
