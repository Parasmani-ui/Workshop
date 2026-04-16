import { Alert, Button } from 'react-bootstrap'

interface Props {
  message: string | null
  onRetry?: () => void
  onDismiss?: () => void
}

export default function ErrorAlert({ message, onRetry, onDismiss }: Props) {
  if (!message) return null
  return (
    <Alert variant="danger" onClose={onDismiss} dismissible={!!onDismiss}>
      <div className="d-flex justify-content-between align-items-center gap-3">
        <div className="flex-grow-1">{message}</div>
        {onRetry && (
          <Button size="sm" variant="outline-danger" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    </Alert>
  )
}
