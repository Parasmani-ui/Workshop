import { Table } from 'react-bootstrap'
import type { LeaderboardEntry, Team } from '@/types/game.types'
import { WIN_CRITERIA_FORMATTER } from '@/utils/formatters'

interface LeaderboardTableProps {
  entries: LeaderboardEntry[]
  winCriteria: string
  teams: Team[]
  showQuarter?: number
}

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

function trendCell(trend?: 'up' | 'down' | 'same') {
  if (trend === 'up') return <span className="text-success">↑</span>
  if (trend === 'down') return <span className="text-danger">↓</span>
  return <span className="text-muted">—</span>
}

export default function LeaderboardTable({
  entries,
  winCriteria,
  teams,
  showQuarter,
}: LeaderboardTableProps) {
  const fmt = WIN_CRITERIA_FORMATTER[winCriteria] ?? ((v: number) => String(v))
  const teamByNo = new Map<number, Team>()
  teams.forEach((t) => teamByNo.set(t.teamNo, t))

  // Exclude unplayed teams (no Q1+ output) so a freshly-activated game shows
  // the "no results yet" empty state instead of Q0 bootstrap values.
  const playedEntries = entries.filter((e) => e.played !== false)

  if (playedEntries.length === 0) {
    return (
      <div className="text-center text-muted py-4">
        <div className="fs-5 mb-1">No results yet</div>
        <div className="small">Process a quarter to see rankings</div>
      </div>
    )
  }

  return (
    <div>
      {showQuarter !== undefined && (
        <div className="small text-muted mb-2">Results for Q{showQuarter}</div>
      )}
      <Table striped hover responsive size="sm" className="mb-0">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Team</th>
            <th>Team Name</th>
            <th className="text-end">Value</th>
            <th className="text-end">Share Price</th>
            <th className="text-center">Trend</th>
          </tr>
        </thead>
        <tbody>
          {playedEntries.map((e) => {
            const team = teamByNo.get(e.teamNo)
            const medal = MEDALS[e.rank] ?? ''
            return (
              <tr key={e.teamNo}>
                <td className="fw-semibold">
                  {medal} {e.rank}
                </td>
                <td>#{e.teamNo + 1}</td>
                <td>{team?.teamName ?? e.teamName}</td>
                <td className={`text-end fw-semibold ${e.value < 0 ? 'text-danger' : ''}`}>
                  {fmt(e.value)}
                </td>
                <td className="text-end text-muted">—</td>
                <td className="text-center">{trendCell(e.trend)}</td>
              </tr>
            )
          })}
        </tbody>
      </Table>
    </div>
  )
}
