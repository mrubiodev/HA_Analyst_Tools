import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Very small token estimator (approx chars/4). Good enough for budgeting.
export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.max(0, Math.ceil(text.length / 4))
}

export function estimateMessagesTokens(system: string, messages: { role: string; content: string }[]): number {
  let t = estimateTokens(system)
  for (const m of messages) t += estimateTokens(`${m.role}: ${m.content}`)
  return t
}

export function loadJsonStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function saveJsonStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore storage errors
  }
}

function compareFilterValues(left: string, right: string): number {
  const leftNumber = Number(left)
  const rightNumber = Number(right)
  if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber)) {
    return leftNumber === rightNumber ? 0 : leftNumber > rightNumber ? 1 : -1
  }

  const leftDate = Date.parse(left)
  const rightDate = Date.parse(right)
  if (!Number.isNaN(leftDate) && !Number.isNaN(rightDate)) {
    return leftDate === rightDate ? 0 : leftDate > rightDate ? 1 : -1
  }

  return left.localeCompare(right, 'es', { sensitivity: 'base', numeric: true })
}

export function matchesAdvancedFilter(value: string, expression: string): boolean {
  const rawValue = value.trim()
  const normalizedValue = rawValue.toLowerCase()
  const rawExpression = expression.trim()
  const normalizedExpression = rawExpression.toLowerCase()

  if (!normalizedExpression) return true
  if (normalizedExpression === 'empty') return rawValue === ''
  if (normalizedExpression === '!empty') return rawValue !== ''

  if (rawExpression.startsWith('!=')) return compareFilterValues(rawValue, rawExpression.slice(2).trim()) !== 0
  if (rawExpression.startsWith('>=')) return compareFilterValues(rawValue, rawExpression.slice(2).trim()) >= 0
  if (rawExpression.startsWith('<=')) return compareFilterValues(rawValue, rawExpression.slice(2).trim()) <= 0
  if (rawExpression.startsWith('>')) return compareFilterValues(rawValue, rawExpression.slice(1).trim()) > 0
  if (rawExpression.startsWith('<')) return compareFilterValues(rawValue, rawExpression.slice(1).trim()) < 0
  if (rawExpression.startsWith('=')) return compareFilterValues(rawValue, rawExpression.slice(1).trim()) === 0
  if (rawExpression.startsWith('^')) return normalizedValue.startsWith(rawExpression.slice(1).trim().toLowerCase())
  if (rawExpression.startsWith('$')) return normalizedValue.endsWith(rawExpression.slice(1).trim().toLowerCase())

  return normalizedValue.includes(normalizedExpression)
}
