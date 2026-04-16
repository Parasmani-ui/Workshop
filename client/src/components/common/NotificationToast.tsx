import { useEffect } from 'react'
import { Toast, ToastContainer } from 'react-bootstrap'
import { useUIStore } from '@/store/uiStore'

const VARIANT_BY_TYPE: Record<'success' | 'error' | 'info' | 'warning', string> = {
  success: 'success',
  error: 'danger',
  info: 'info',
  warning: 'warning',
}

const AUTO_DISMISS_MS = 4000

interface ToastItemProps {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
  onClose: (id: string) => void
}

function ToastItem({ id, type, message, onClose }: ToastItemProps) {
  const autoDismiss = type === 'success' || type === 'info'

  useEffect(() => {
    if (!autoDismiss) return
    const timer = setTimeout(() => onClose(id), AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [id, autoDismiss, onClose])

  return (
    <Toast bg={VARIANT_BY_TYPE[type]} onClose={() => onClose(id)} show>
      <Toast.Header closeButton>
        <strong className="me-auto text-uppercase small">{type}</strong>
      </Toast.Header>
      <Toast.Body className={type === 'warning' ? 'text-dark' : 'text-white'}>
        {message}
      </Toast.Body>
    </Toast>
  )
}

export default function NotificationToast() {
  const notifications = useUIStore((s) => s.notifications)
  const removeNotification = useUIStore((s) => s.removeNotification)

  return (
    <ToastContainer
      position="bottom-end"
      className="p-3"
      style={{ position: 'fixed', zIndex: 1080 }}
    >
      {notifications.map((n) => (
        <ToastItem
          key={n.id}
          id={n.id}
          type={n.type}
          message={n.message}
          onClose={removeNotification}
        />
      ))}
    </ToastContainer>
  )
}
