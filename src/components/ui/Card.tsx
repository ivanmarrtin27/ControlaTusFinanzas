import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevated?: boolean
  accent?: boolean
  children: ReactNode
}

export function Card({
  elevated = false,
  accent = false,
  className = '',
  children,
  ...rest
}: CardProps) {
  const classes = [
    'card',
    elevated ? 'card-elevated' : '',
    accent ? 'card-accent' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  )
}
