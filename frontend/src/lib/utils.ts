import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('pl-PL', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
  }).format(amount)
}

export function formatTime(time: string): string {
  return new Date(`2000-01-01T${time}`).toLocaleTimeString('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
  })
}
