import { Spinner } from 'react-bootstrap'

interface Props {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  fullPage?: boolean
}

const SIZE_STYLE: Record<NonNullable<Props['size']>, { width: string; height: string }> = {
  sm: { width: '1rem', height: '1rem' },
  md: { width: '2rem', height: '2rem' },
  lg: { width: '3rem', height: '3rem' },
}

export default function LoadingSpinner({
  size = 'md',
  text = 'Loading...',
  fullPage = false,
}: Props) {
  const spinnerSize = size === 'sm' ? 'sm' : undefined
  const style = SIZE_STYLE[size]

  const content = (
    <div className="d-flex align-items-center gap-2 text-muted">
      <Spinner animation="border" size={spinnerSize} style={style} />
      {text && <span>{text}</span>}
    </div>
  )

  if (fullPage) {
    return (
      <div
        className="d-flex justify-content-center align-items-center"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(255,255,255,0.7)',
          zIndex: 1090,
        }}
      >
        {content}
      </div>
    )
  }

  return content
}
