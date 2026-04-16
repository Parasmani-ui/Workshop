import { useState, useCallback } from 'react'
import type { Decision } from '@/types/decision.types'
import { decisionApi } from '@/services/api'
import { useUIStore } from '@/store/uiStore'

export function useDecision(gameId: string, teamNo: number, quarterNo: number) {
  const [decision, setDecision] = useState<Decision | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { addNotification } = useUIStore()

  const load = useCallback(async () => {
    try {
      const res = await decisionApi.getOne(gameId, teamNo, quarterNo)
      setDecision(res.data.data.decision)
    } catch {
      setDecision(null)
    }
  }, [gameId, teamNo, quarterNo])

  const submit = useCallback(
    async (payload: Decision) => {
      setIsSubmitting(true)
      try {
        const res = await decisionApi.submit(gameId, payload)
        setDecision(res.data.data.decision)
        addNotification('success', 'Decision submitted')
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to submit decision'
        addNotification('error', msg)
      } finally {
        setIsSubmitting(false)
      }
    },
    [gameId, addNotification]
  )

  return { decision, isSubmitting, load, submit }
}
