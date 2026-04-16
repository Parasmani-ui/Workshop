import { create } from 'zustand'

interface Notification {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
}

interface UIState {
  notifications: Notification[]
  isSidebarOpen: boolean
  addNotification: (type: Notification['type'], message: string) => void
  removeNotification: (id: string) => void
  toggleSidebar: () => void
}

export const useUIStore = create<UIState>((set) => ({
  notifications: [],
  isSidebarOpen: true,

  addNotification: (type, message) =>
    set((state) => ({
      notifications: [
        ...state.notifications,
        { id: Date.now().toString(), type, message },
      ],
    })),

  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  toggleSidebar: () =>
    set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
}))
