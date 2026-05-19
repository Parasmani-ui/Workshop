export function formatCurrency(value: number): string {
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2)} Cr`
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(2)} L`
  return `₹${value.toLocaleString('en-IN')}`
}

export function formatCurrencyShort(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 10_000_000) return `${(value / 10_000_000).toFixed(2)} Cr`
  if (abs >= 100_000) return `${(value / 100_000).toFixed(2)} L`
  return value.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

export function formatCurrencyFull(value: number): string {
  return `₹${value.toLocaleString('en-IN')}`
}

export function formatAmount(value: number, decimals = 2): string {
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  })
}

export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`
}

export function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString('en-IN', { maximumFractionDigits: decimals })
}

export function formatSharePrice(value: number): string {
  return `₹${value.toFixed(2)}`
}

export function formatRatio(value: number): string {
  return value.toFixed(2)
}

export const WIN_CRITERIA_FORMATTER: Record<string, (v: number) => string> = {
  M: formatCurrency,
  N: formatCurrency,
  P: formatCurrency,
  E: formatCurrency,
  V: formatSharePrice,
  A: formatSharePrice,
  B: formatSharePrice,
  C: formatSharePrice,
  O: formatCurrency,
}
