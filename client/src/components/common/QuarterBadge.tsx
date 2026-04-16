interface QuarterBadgeProps {
  quarterNo: number
  maxQuarters?: number
  size?: 'sm' | 'md' | 'lg'
}

const SIZE_CLASS: Record<NonNullable<QuarterBadgeProps['size']>, string> = {
  sm: 'fs-6',
  md: 'fs-5',
  lg: 'fs-4',
}

export default function QuarterBadge({
  quarterNo,
  maxQuarters,
  size = 'md',
}: QuarterBadgeProps) {
  const label = maxQuarters ? `Q${quarterNo} / Q${maxQuarters}` : `Q${quarterNo}`
  return (
    <span
      className={`badge rounded-pill bg-primary px-3 py-2 ${SIZE_CLASS[size]}`}
    >
      {label}
    </span>
  )
}
