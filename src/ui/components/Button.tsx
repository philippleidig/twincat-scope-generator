import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { forwardRef } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant
    size?: 'sm' | 'md'
    icon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    { variant = 'secondary', size = 'md', icon, className = '', children, type = 'button', ...rest },
    ref,
) {
    return (
        <button ref={ref} type={type} className={`btn btn--${variant} btn--${size} ${className}`} {...rest}>
            {icon}
            {children}
        </button>
    )
})

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    /** Accessible name; also shown as tooltip. */
    label: string
    ref?: Ref<HTMLButtonElement>
    variant?: Variant
    size?: 'sm' | 'md'
}

export function IconButton({ label, variant = 'ghost', size = 'sm', className = '', children, type = 'button', ...rest }: IconButtonProps) {
    return (
        <button type={type} aria-label={label} title={label} className={`btn btn--${variant} btn--${size} btn--icon ${className}`} {...rest}>
            {children}
        </button>
    )
}
