import { useEffect, useRef } from 'react'
import { connectSocket, getSocket } from '@/services/socket'
import { useGameStore } from '@/store/gameStore'
import { useUIStore } from '@/store/uiStore'

export function useSocket(gameId?: string) {
  const { updateGameStatus } = useGameStore()
  const { addNotification } = useUIStore()
  const joinedRoom = useRef<string | null>(null)

  useEffect(() => {
    const socket = connectSocket()

    if (gameId && joinedRoom.current !== gameId) {
      socket.emit('join:game', gameId)
      joinedRoom.current = gameId
    }

    socket.on('game:activated', ({ currentQuarter }: { currentQuarter: number }) => {
      addNotification('success', `Game started! Quarter ${currentQuarter} open.`)
      updateGameStatus('active', currentQuarter)
    })

    socket.on('game:quarterLocked', ({ quarterNo }: { quarterNo: number }) => {
      addNotification('info', `Quarter ${quarterNo} locked — no more submissions`)
      updateGameStatus('processing')
    })

    socket.on('game:processingStarted', () => {
      addNotification('info', 'Engine processing quarter...')
    })

    socket.on('game:processingComplete', ({ quarterNo }: { quarterNo: number }) => {
      addNotification('success', `Quarter ${quarterNo} processed!`)
      useGameStore.getState().setProcessingReady(true)
    })

    socket.on('game:resultsPublished', ({ newQuarter }: { newQuarter: number }) => {
      addNotification('success', `Results published! Starting Quarter ${newQuarter}`)
      updateGameStatus('active', newQuarter)
      useGameStore.getState().setProcessingReady(false)
    })

    socket.on('team:decisionReceived', ({ teamNo }: { teamNo: number }) => {
      addNotification('info', `Team ${teamNo} submitted decisions`)
    })

    socket.on('game:processingError', ({ message }: { message: string }) => {
      addNotification('error', `Engine error: ${message}`)
    })

    return () => {
      socket.off('game:activated')
      socket.off('game:quarterLocked')
      socket.off('game:processingStarted')
      socket.off('game:processingComplete')
      socket.off('game:resultsPublished')
      socket.off('team:decisionReceived')
      socket.off('game:processingError')
      if (gameId) socket.emit('leave:game', gameId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId])

  return getSocket()
}
