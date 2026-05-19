import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from 'react-bootstrap'
import { authApi } from '@/services/api'
import { useGameStore } from '@/store/gameStore'
import { useUIStore } from '@/store/uiStore'
import QuarterBadge from '@/components/common/QuarterBadge'
import StatCard from '@/components/common/StatCard'

const STATUS_VARIANT: Record<string, string> = {
  setup: 'bg-secondary',
  active: 'bg-success',
  processing: 'bg-warning text-dark',
  completed: 'bg-primary',
}

type MyGameEntry = Awaited<
  ReturnType<typeof authApi.myGames>
>['data']['data']['games'][number]

export default function TeamDashboard() {
  const navigate = useNavigate()
  const { authUser, setIdentity } = useGameStore()
  const { addNotification } = useUIStore()

  const [games, setGames] = useState<MyGameEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchMyGames = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authApi.myGames()
      setGames(res.data.data.games)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load your games'
      addNotification('error', msg)
    } finally {
      setLoading(false)
    }
  }, [addNotification])

  useEffect(() => {
    fetchMyGames()
  }, [fetchMyGames])

  const openGame = (entry: MyGameEntry) => {
    setIdentity('team', entry.team.teamNo, entry.team.gameId)
    localStorage.setItem('chanakya_gameId', entry.team.gameId)
    localStorage.setItem('chanakya_teamNo', String(entry.team.teamNo))
    navigate(`/team/game/${entry.team.gameId}`)
  }

  const activeCount = games.filter(
    (g) => g.game.status === 'active' || g.game.status === 'processing'
  ).length

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-0">My Games</h2>
          <div className="text-muted small">
            {authUser ? `Signed in as ${authUser.name}` : 'Signed in'}
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <StatCard
            title="Active Games"
            value={activeCount}
            variant="success"
            icon="🟢"
          />
        </div>
        <div className="col-md-4">
          <StatCard
            title="Joined Games"
            value={games.length}
            variant="primary"
            icon="📊"
          />
        </div>
      </div>

      {loading && <div className="text-muted">Loading your games...</div>}

      {!loading && games.length === 0 && (
        <div className="bg-white rounded-3 shadow-sm p-5 text-center">
          <div className="fs-4 mb-2">You haven't joined any games yet</div>
          <div className="text-muted mb-3">
            Use the <strong>Join Game</strong> button in the top bar to join one.
          </div>
        </div>
      )}

      {!loading && games.length > 0 && (
        <div className="row g-3">
          {games.map((entry) => {
            const { game, team } = entry
            const statusCls = STATUS_VARIANT[game.status] ?? 'bg-secondary'
            return (
              <div key={game.gameId} className="col-md-6 col-lg-4">
                <div className="bg-white rounded-3 shadow-sm p-3 h-100 d-flex flex-column">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div>
                      <div className="fw-bold fs-5">{game.name}</div>
                      <span className="badge bg-light text-dark border">
                        {game.gameId}
                      </span>
                    </div>
                    <span className={`badge ${statusCls} text-uppercase`}>
                      {game.status}
                    </span>
                  </div>

                  <div className="mb-2">
                    <QuarterBadge
                      quarterNo={game.currentQuarter}
                      maxQuarters={game.maxQuarters}
                      size="sm"
                    />
                  </div>

                  <div className="small text-muted mb-1">
                    Team #{team.teamNo + 1} · {team.teamName}
                  </div>
                  <div className="small text-muted mb-3">
                    {game.noOfTeams} teams · Win: {game.winCriteria}
                  </div>

                  <Button
                    variant="outline-primary"
                    size="sm"
                    className="mt-auto"
                    onClick={() => openGame(entry)}
                  >
                    Open
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
