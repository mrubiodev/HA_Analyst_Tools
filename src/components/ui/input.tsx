import * as React from 'react'
import { cn } from '@/lib/utils'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  (allProps, ref) => {
    const { className, value, defaultValue, ...props } = allProps as React.InputHTMLAttributes<HTMLInputElement>
    // Ensure we don't switch between controlled and uncontrolled by
    // normalizing an explicit `value={undefined}` to an empty string
    // when the component is being used as a controlled input.
    const isControlled = Object.prototype.hasOwnProperty.call(allProps, 'value') || typeof value !== 'undefined'
    const safeValue = isControlled ? (value ?? '') : undefined

    return (
      <input
        ref={ref}
        className={cn(
          'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        // prefer controlled `value` when present, otherwise fall back to defaultValue
        value={safeValue}
        defaultValue={defaultValue}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'
