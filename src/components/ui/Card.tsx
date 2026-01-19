import React from 'react'
import './Card.css'

interface CardProps {
    title?: string
    children: React.ReactNode
    className?: string
    actions?: React.ReactNode
}

export function Card({ title, children, className = '', actions }: CardProps) {
    return (
        <div className={`card ${className}`}>
            {(title || actions) && (
                <div className="card-header">
                    {title && <h3 className="card-title">{title}</h3>}
                    {actions && <div className="card-actions">{actions}</div>}
                </div>
            )}
            <div className="card-content">{children}</div>
        </div>
    )
}
