import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from 'react-bootstrap'
import { useGameStore } from '@/store/gameStore'
import { useSocket } from '@/hooks/useSocket'
import { gameApi, decisionApi, reportApi } from '@/services/api'
import type { Game } from '@/types/game.types'
import type { TeamReport } from '@/types/report.types'
import StatCard from '@/components/common/StatCard'
import QuarterBadge from '@/components/common/QuarterBadge'
import {
  formatCurrency,
  formatSharePrice,
} from '@/utils/formatters'

export default function TeamDashboard() {
  const { myTeamNo, myGameId, teams, setGame, currentGame } = useGameStore()

  const [game, setLocalGame] = useState<Game | null>(currentGame)
  const [lastReport, setLastReport] = useState<TeamReport | null>(null)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [rank, setRank] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const gameId = myGameId ?? localStorage.getItem('chanakya_gameId') ?? ''

  useSocket(gameId)

  // When the socket updates currentGame in the store (e.g. facilitator
  // publishes results and currentQuarter advances), re-run the loader so
  // `hasSubmitted` reflects the new quarter.
  const socketQuarter = currentGame?.currentQuarter
  const socketStatus = currentGame?.status

  useEffect(() => {
    if (!gameId || myTeamNo === null) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)

    const load = async () => {
      try {
        const gameRes = await gameApi.get(gameId)
        if (cancelled) return
        const g = gameRes.data.data.game
        setLocalGame(g)
        setGame(g)

        const currentQ = g.currentQuarter ?? 1
        const lastQ = Math.max(0, currentQ - 1)

        const [decisionRes, reportRes, lbRes] = await Promise.all([
          decisionApi.getOne(gameId, myTeamNo, currentQ).catch(() => null),
          lastQ > 0
            ? reportApi.getTeamReport(gameId, myTeamNo, lastQ).catch(() => null)
            : Promise.resolve(null),
          gameApi.leaderboard(gameId).catch(() => null),
        ])

        if (cancelled) return
        setHasSubmitted(!!decisionRes?.data.data.decision)
        setLastReport(reportRes?.data.data.report ?? null)
        const entries = lbRes?.data.data.leaderboard ?? []
        const me = entries.find((e) => e.teamNo === myTeamNo)
        setRank(me?.rank ?? null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [gameId, myTeamNo, setGame, socketQuarter, socketStatus])

  if (!gameId || myTeamNo === null) {
    return (
      <div className="bg-white rounded-3 shadow-sm p-5 text-center text-muted">
        <div className="fs-5 mb-2">No game session found.</div>
        <div className="small mb-3">Please log in as a team to start.</div>
        <Link to="/login" className="btn btn-primary btn-sm">
          Go to Login
        </Link>
      </div>
    )
  }

  const myTeam = teams.find((t) => t.teamNo === myTeamNo)
  const teamName = myTeam?.teamName ?? `Team ${(myTeamNo ?? 0) + 1}`
  const currentQuarter = game?.currentQuarter ?? 0
  const maxQuarters = game?.maxQuarters ?? 5

  const lastRevenue = lastReport?.pandl.srev ?? 0
  const lastSharePrice = lastReport?.pandl.esprice ?? 0
  const lastPat = lastReport?.pandl.netinc ?? 0

  return (
    <div>
      <div className="bg-white rounded-3 shadow-sm p-3 mb-4">
        <div className="d-flex flex-wrap align-items-center gap-3">
          <h3 className="mb-0">Welcome, {teamName}</h3>
          <span className="badge bg-light text-dark border">{game?.name ?? gameId}</span>
          <QuarterBadge quarterNo={currentQuarter} maxQuarters={maxQuarters} />
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-3 shadow-sm p-4 text-center text-muted">
          Loading dashboard...
        </div>
      ) : (
        <>
          <div className="row g-3 mb-3">
            <div className="col-md-3">
              <StatCard
                title="Current Quarter"
                value={`Q${currentQuarter}`}
                subtitle={`of ${maxQuarters}`}
                variant="primary"
              />
            </div>
            <div className="col-md-3">
              <StatCard
                title="Last Qtr Revenue"
                value={lastReport ? formatCurrency(lastRevenue) : '—'}
              />
            </div>
            <div className="col-md-3">
              <StatCard
                title="Last Qtr Share Price"
                value={lastReport ? formatSharePrice(lastSharePrice) : '—'}
              />
            </div>
            <div className="col-md-3">
              <StatCard
                title="Rank"
                value={rank !== null ? `#${rank}` : '—'}
                variant={rank === 1 ? 'success' : 'default'}
              />
            </div>
          </div>

          <div className="row g-3">
            <div className="col-md-6">
              <div className="bg-white rounded-3 shadow-sm p-3 h-100">
                <h5 className="mb-3">Submit Decisions</h5>
                <div className="mb-3">Current: Quarter {currentQuarter}</div>
                {hasSubmitted ? (
                  <div className="alert alert-success py-2 mb-3">
                    ✅ Decisions submitted for Q{currentQuarter}
                  </div>
                ) : (
                  <div className="alert alert-warning py-2 mb-3">
                    ⚠️ Decisions pending for Q{currentQuarter}
                  </div>
                )}
                <Link to={`/team/game/${gameId}/decisions`}>
                  <Button variant={hasSubmitted ? 'outline-secondary' : 'primary'}>
                    {hasSubmitted ? 'View Submitted Decisions' : 'Go to Decision Form'}
                  </Button>
                </Link>
              </div>
            </div>

            <div className="col-md-6">
              <div className="bg-white rounded-3 shadow-sm p-3 h-100">
                <h5 className="mb-3">My Last Report</h5>
                {lastReport ? (
                  <>
                    <div className="mb-2">
                      <span className="text-muted small">PAT:&nbsp;</span>
                      <span
                        className={`fw-semibold ${
                          lastPat >= 0 ? 'text-success' : 'text-danger'
                        }`}
                      >
                        {formatCurrency(lastPat)}
                      </span>
                    </div>
                    <div className="mb-3">
                      <span className="text-muted small">Share Price:&nbsp;</span>
                      <span className="fw-semibold">
                        {formatSharePrice(lastSharePrice)}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-muted small mb-3">
                    No report published yet.
                  </div>
                )}
                <Link to={`/team/game/${gameId}/reports`}>
                  <Button variant="outline-primary">View Full Report</Button>
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
