interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: string
  variant?: 'default' | 'success' | 'danger' | 'warning' | 'primary'
  trend?: 'up' | 'down' | 'neutral'
  onClick?: () => void
}

const VARIANT_BORDERS: Record<NonNullable<StatCardProps['variant']>, string> = {
  default: '',
  primary: 'border-start border-primary border-3',
  success: 'border-start border-success border-3',
  danger: 'border-start border-danger border-3',
  warning: 'border-start border-warning border-3',
}

const TREND_SYMBOL: Record<NonNullable<StatCardProps['trend']>, { char: string; cls: string }> = {
  up: { char: '↑', cls: 'text-success' },
  down: { char: '↓', cls: 'text-danger' },
  neutral: { char: '→', cls: 'text-muted' },
}

export default function StatCard({
  title,
  value,
  subtitle,
  icon,
  variant = 'default',
  trend,
  onClick,
}: StatCardProps) {
  const borderCls = VARIANT_BORDERS[variant]
  const clickable = onClick ? 'cursor-pointer' : ''

  return (
    <div
      className={`bg-white rounded-3 shadow-sm p-3 h-100 ${borderCls} ${clickable}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <div className="d-flex justify-content-between align-items-start">
        <div className="text-muted small text-uppercase fw-semibold">{title}</div>
        {icon && <div className="fs-4 text-muted">{icon}</div>}
      </div>
      <div className="fw-bold fs-3 mt-1">{value}</div>
      {(subtitle || trend) && (
        <div className="d-flex align-items-center gap-2 small mt-1">
          {trend && (
            <span className={TREND_SYMBOL[trend].cls}>{TREND_SYMBOL[trend].char}</span>
          )}
          {subtitle && <span className="text-muted">{subtitle}</span>}
        </div>
      )}
    </div>
  )
}
