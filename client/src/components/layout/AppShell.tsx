import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import NotificationToast from '@/components/common/NotificationToast'

interface Props {
  role: 'facilitator' | 'team'
}

export default function AppShell({ role }: Props) {
  return (
    <div className="app-shell">
      <Sidebar role={role} />
      <div className="main-content">
        <TopBar />
        <div className="page-content">
          <Outlet />
        </div>
      </div>
      <NotificationToast />
    </div>
  )
}
