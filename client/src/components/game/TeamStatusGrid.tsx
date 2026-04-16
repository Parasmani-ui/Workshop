import type { Team } from '@/types/game.types'

interface DecisionStatus {
  teamNo: number
  submittedAt: string
  isLocked: boolean
}

interface TeamStatusGridProps {
  teams: Team[]
  decisions: DecisionStatus[]
  currentQuarter: number
  isLocked: boolean
  totalTeams: number
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export default function TeamStatusGrid({
  teams,
  decisions,
  currentQuarter,
  isLocked,
  totalTeams,
}: TeamStatusGridProps) {
  const byTeam = new Map<number, DecisionStatus>()
  decisions.forEach((d) => byTeam.set(d.teamNo, d))

  const teamMap = new Map<number, Team>()
  teams.forEach((t) => teamMap.set(t.teamNo, t))

  // Build list of all team slots (0..totalTeams-1),
  // plus any extra teamNos from decisions not in that range
  const allTeamNos = Array.from(
    new Set([
      ...Array.from({ length: totalTeams }, (_, i) => i),
      ...decisions.map((d) => d.teamNo),
    ])
  ).sort((a, b) => a - b)

  const submittedCount = decisions.length
  const displayTotal = Math.max(totalTeams, allTeamNos.length)
  const pct = displayTotal === 0 ? 0 : Math.round((submittedCount / displayTotal) * 100)

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div className="small text-muted">Quarter {currentQuarter} submissions</div>
        <div className="fw-semibold">
          {submittedCount} / {totalTeams} submitted
        </div>
      </div>

      <div className="progress mb-3" style={{ height: 8 }}>
        <div
          className="progress-bar bg-success"
          role="progressbar"
          style={{ width: `${pct}%` }}
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      <div className="row g-2">
        {allTeamNos.map((teamNo) => {
          const team = teamMap.get(teamNo)
          const dec = byTeam.get(teamNo)
          const submitted = !!dec

          let badgeCls = 'bg-warning text-dark'
          let badgeText = 'Pending'
          if (isLocked && submitted) {
            badgeCls = 'bg-primary'
            badgeText = 'Locked'
          } else if (submitted) {
            badgeCls = 'bg-success'
            badgeText = 'Submitted'
          }

          const displayName = team?.teamName || `Team ${teamNo + 1}`
          const ceo = team?.ceo || ''

          return (
            <div key={teamNo} className="col-12 col-sm-6">
              <div className="bg-white rounded-3 border p-2">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <div className="fw-semibold">
                      #{teamNo + 1} {displayName}
                    </div>
                    {ceo && (
                      <div className="small text-muted">CEO: {ceo}</div>
                    )}
                  </div>
                  <span className={`badge ${badgeCls}`}>{badgeText}</span>
                </div>
                {submitted && dec && (
                  <div className="small text-muted mt-1">
                    Submitted {formatTime(dec.submittedAt)}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
