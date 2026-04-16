import { useEffect, useCallback } from 'react'
import { useGameStore } from '@/store/gameStore'
import { gameApi, teamApi } from '@/services/api'
import { useUIStore } from '@/store/uiStore'

export function useGame(gameId: string) {
  const {
    setGame,
    setTeams,
    setLeaderboard,
    setLoading,
    setError,
    currentGame,
    teams,
    leaderboard,
  } = useGameStore()
  const { addNotification } = useUIStore()

  const fetchGame = useCallback(async () => {
    if (!gameId) return
    setLoading(true)
    try {
      const [gameRes, teamsRes, lbRes] = await Promise.all([
        gameApi.get(gameId),
        teamApi.list(gameId),
        gameApi.leaderboard(gameId),
      ])
      setGame(gameRes.data.data.game)
      setTeams(teamsRes.data.data.teams)
      setLeaderboard(lbRes.data.data.leaderboard)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load game'
      setError(msg)
      addNotification('error', msg)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId])

  useEffect(() => {
    fetchGame()
  }, [fetchGame])

  return { currentGame, teams, leaderboard, refetch: fetchGame }
}
