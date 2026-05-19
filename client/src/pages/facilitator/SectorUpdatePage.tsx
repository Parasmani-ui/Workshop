import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, Table } from 'react-bootstrap'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useGame } from '@/hooks/useGame'
import { gameApi, reportApi } from '@/services/api'
import type { SectorEntry, TeamReport } from '@/types/report.types'
import type { LeaderboardEntry } from '@/types/game.types'
import { WIN_CRITERIA_LABELS } from '@/types/game.types'
import {
  formatCurrencyShort,
  formatRatio,
  formatAmount,
} from '@/utils/formatters'
import LeaderboardTable from '@/components/game/LeaderboardTable'

interface MetricRow {
  label: string
  key: string
  format: (v: number) => string
  higherIsBetter: boolean
  getValue: (e: SectorEntry, r: TeamReport | undefined) => number | null
}

const formatPrice = (v: number) => formatAmount(v, 2)

const METRIC_ROWS: MetricRow[] = [
  {
    label: 'Revenue (₹)',
    key: 'rev',
    format: formatCurrencyShort,
    higherIsBetter: true,
    getValue: (_e, r) => r?.pandl.srev ?? null,
  },
  {
    label: 'Gross Profit (₹)',
    key: 'gp',
    format: formatCurrencyShort,
    higherIsBetter: true,
    getValue: (_e, r) => r?.pandl.gprofit ?? null,
  },
  {
    label: 'PAT (₹)',
    key: 'pat',
    format: formatCurrencyShort,
    higherIsBetter: true,
    getValue: (e) => e.netinc,
  },
  {
    label: 'EBITDA (₹)',
    key: 'ebitda',
    format: formatCurrencyShort,
    higherIsBetter: true,
    getValue: (_e, r) => {
      if (!r) return null
      const p = r.pandl
      return p.gprofit - p.sadexp - p.randexp - p.bdebts - p.sdisc
    },
  },
  {
    label: 'Share Price (₹)',
    key: 'sp',
    format: formatPrice,
    higherIsBetter: true,
    getValue: (e) => e.esprice,
  },
  {
    label: 'Market Cap (₹)',
    key: 'mc',
    format: formatCurrencyShort,
    higherIsBetter: true,
    getValue: (e) => e.marketCap,
  },
  {
    label: 'Net Worth (₹)',
    key: 'nw',
    format: formatCurrencyShort,
    higherIsBetter: true,
    getValue: (e) => e.toteq,
  },
  {
    label: 'Current Ratio',
    key: 'cr',
    format: formatRatio,
    higherIsBetter: true,
    getValue: (e) => e.cratio,
  },
  {
    label: 'D/E Ratio',
    key: 'de',
    format: formatRatio,
    higherIsBetter: false,
    getValue: (e) => e.de,
  },
  {
    label: 'EPS (₹)',
    key: 'eps',
    format: formatPrice,
    higherIsBetter: true,
    getValue: (e) => e.eps,
  },
]

export default function SectorUpdatePage() {
  const { gameId, quarterNo } = useParams<{ gameId: string; quarterNo: string }>()
  const navigate = useNavigate()
  const parsedQuarter = parseInt(quarterNo ?? '1', 10)

  const { teams, currentGame } = useGame(gameId ?? '')

  const [sectorEntries, setSectorEntries] = useState<SectorEntry[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [teamReports, setTeamReports] = useState<Map<number, TeamReport>>(new Map())
  const [loading, setLoading] = useState(false)
  const [noData, setNoData] = useState(false)

  const maxQuarters = currentGame?.maxQuarters ?? 5
  const winCriteria = currentGame?.winCriteria ?? 'M'

  useEffect(() => {
    if (!gameId || !parsedQuarter) return
    let cancelled = false
    setLoading(true)
    setNoData(false)
    setSectorEntries([])
    setTeamReports(new Map())

    Promise.all([
      reportApi.getSectorUpdate(gameId, parsedQuarter).catch(() => null),
      gameApi.leaderboard(gameId).catch(() => null),
    ])
      .then(async ([sectorRes, lbRes]) => {
        if (cancelled) return
        const entries = sectorRes?.data.data.teams ?? []
        setSectorEntries(entries)
        setLeaderboard(lbRes?.data.data.leaderboard ?? [])
        if (entries.length === 0) {
          setNoData(true)
          return
        }
        const reportResults = await Promise.all(
          entries.map((e) =>
            reportApi
              .getTeamReport(gameId, e.teamNo, parsedQuarter)
              .then((r) => [e.teamNo, r.data.data.report] as const)
              .catch(() => null)
          )
        )
        if (cancelled) return
        const map = new Map<number, TeamReport>()
        for (const result of reportResults) {
          if (result) map.set(result[0], result[1])
        }
        setTeamReports(map)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [gameId, parsedQuarter])

  const sortedEntries = useMemo(
    () => [...sectorEntries].sort((a, b) => a.teamNo - b.teamNo),
    [sectorEntries]
  )

  const goToQuarter = (q: number) => {
    if (q < 1 || q > maxQuarters) return
    navigate(`/facilitator/game/${gameId}/sector/${q}`)
  }

  const prodCharts = [1, 2, 3, 4].map((pIdx) => {
    const data = sortedEntries.map((e) => {
      const r = teamReports.get(e.teamNo)
      const ord = r
        ? (r.saledata[`ordbook${pIdx}` as keyof typeof r.saledata] as number)
        : 0
      return { team: `T${e.teamNo}`, orders: ord }
    })
    return { pIdx, data }
  })

  return (
    <div>
      <div className="bg-white rounded-3 shadow-sm p-3 mb-4">
        <div className="d-flex flex-wrap align-items-center gap-3">
          <h3 className="mb-0">Sector Update — Q{parsedQuarter}</h3>
          <div className="ms-auto">
            <Link to={`/facilitator/game/${gameId}`} className="small">
              ← Back to Quarter Control
            </Link>
          </div>
        </div>
        <div className="d-flex align-items-center gap-2 mt-3">
          <Button
            size="sm"
            variant="outline-secondary"
            disabled={parsedQuarter <= 1}
            onClick={() => goToQuarter(parsedQuarter - 1)}
          >
            ← Previous
          </Button>
          {Array.from({ length: maxQuarters }, (_, i) => i + 1).map((q) => (
            <Button
              key={q}
              size="sm"
              variant={q === parsedQuarter ? 'primary' : 'outline-secondary'}
              onClick={() => goToQuarter(q)}
            >
              Q{q}
            </Button>
          ))}
          <Button
            size="sm"
            variant="outline-secondary"
            disabled={parsedQuarter >= maxQuarters}
            onClick={() => goToQuarter(parsedQuarter + 1)}
          >
            Next →
          </Button>
        </div>
      </div>

      {loading && (
        <div className="bg-white rounded-3 shadow-sm p-4 text-center text-muted">
          Loading sector data...
        </div>
      )}

      {!loading && noData && (
        <div className="bg-white rounded-3 shadow-sm p-5 text-center text-muted">
          <div className="fs-5 mb-2">No data for Q{parsedQuarter} yet.</div>
          <div className="small">Process and publish this quarter first.</div>
        </div>
      )}

      {!loading && !noData && (
        <>
          <div className="bg-white rounded-3 shadow-sm p-3 mb-3">
            <h5 className="mb-1">Leaderboard — {WIN_CRITERIA_LABELS[winCriteria]}</h5>
            <div className="small text-muted mb-3">Ranked by winning criterion</div>
            <LeaderboardTable
              entries={leaderboard}
              winCriteria={winCriteria}
              teams={teams}
              showQuarter={parsedQuarter}
            />
          </div>

          <div className="bg-white rounded-3 shadow-sm p-3 mb-3">
            <h5 className="mb-3">Comparative Financials</h5>
            <ComparativeTable
              entries={sortedEntries}
              reports={teamReports}
            />
          </div>

          <div className="bg-white rounded-3 shadow-sm p-3 mb-3">
            <h5 className="mb-3">Market Share Analysis</h5>
            <div className="row g-3">
              {prodCharts.map(({ pIdx, data }) => (
                <div className="col-md-6" key={pIdx}>
                  <div className="small text-muted mb-1">Product {pIdx} — Order Book</div>
                  <div style={{ height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="team" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="orders" fill="#0d6efd" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-3 shadow-sm p-3">
            <h5 className="mb-3">Sales & Production Table</h5>
            <SalesProductionTable entries={sortedEntries} reports={teamReports} />
          </div>
        </>
      )}
    </div>
  )
}

function ComparativeTable({
  entries,
  reports,
}: {
  entries: SectorEntry[]
  reports: Map<number, TeamReport>
}) {
  if (entries.length === 0) return null

  return (
    <div className="table-responsive">
      <Table hover size="sm" className="mb-0">
        <thead>
          <tr>
            <th>Metric</th>
            {entries.map((e) => (
              <th key={e.teamNo} className="text-end">
                {e.teamName || `Team ${e.teamNo}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {METRIC_ROWS.map((row) => {
            const values = entries.map((e) => row.getValue(e, reports.get(e.teamNo)))
            const nums = values.filter((v): v is number => v !== null)
            const best = nums.length
              ? row.higherIsBetter
                ? Math.max(...nums)
                : Math.min(...nums)
              : null
            const worst = nums.length
              ? row.higherIsBetter
                ? Math.min(...nums)
                : Math.max(...nums)
              : null
            return (
              <tr key={row.key}>
                <td className="fw-semibold">{row.label}</td>
                {values.map((v, i) => {
                  if (v === null) {
                    return (
                      <td key={i} className="text-end text-muted">
                        —
                      </td>
                    )
                  }
                  let bg = ''
                  let weight = ''
                  if (nums.length > 1 && v === best) {
                    bg = 'bg-success-subtle'
                    weight = 'fw-bold'
                  } else if (nums.length > 1 && v === worst) {
                    bg = 'bg-danger-subtle'
                  }
                  const negCls = v < 0 ? 'text-danger' : ''
                  return (
                    <td key={i} className={`text-end ${bg} ${weight} ${negCls}`.trim()}>
                      {row.format(v)}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </Table>
    </div>
  )
}

function SalesProductionTable({
  entries,
  reports,
}: {
  entries: SectorEntry[]
  reports: Map<number, TeamReport>
}) {
  return (
    <div className="table-responsive">
      <Table size="sm" bordered className="mb-0">
        <thead>
          <tr>
            <th rowSpan={2}>Team</th>
            {[1, 2, 3, 4].map((p) => (
              <th key={p} colSpan={3} className="text-center">
                Product {p}
              </th>
            ))}
          </tr>
          <tr>
            {[1, 2, 3, 4].flatMap((p) => [
              <th key={`p${p}p`} className="text-end small">
                Prod
              </th>,
              <th key={`p${p}s`} className="text-end small">
                Sale
              </th>,
              <th key={`p${p}i`} className="text-end small">
                Inv
              </th>,
            ])}
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const r = reports.get(e.teamNo)
            return (
              <tr key={e.teamNo}>
                <td className="fw-semibold">{e.teamName || `Team ${e.teamNo}`}</td>
                {[1, 2, 3, 4].flatMap((p) => {
                  if (!r) {
                    return [
                      <td key={`${p}p`} className="text-end text-muted">—</td>,
                      <td key={`${p}s`} className="text-end text-muted">—</td>,
                      <td key={`${p}i`} className="text-end text-muted">—</td>,
                    ]
                  }
                  const prod = r.saledata[`prod${p}` as keyof typeof r.saledata] as number
                  const sale = r.saledata[`sale${p}` as keyof typeof r.saledata] as number
                  const inv = r.saledata[`closeinv${p}` as keyof typeof r.saledata] as number
                  const saleCls =
                    sale > prod ? 'bg-success-subtle' : sale < prod ? 'bg-warning-subtle' : ''
                  return [
                    <td key={`${p}p`} className="text-end">{prod.toLocaleString('en-IN')}</td>,
                    <td key={`${p}s`} className={`text-end ${saleCls}`}>{sale.toLocaleString('en-IN')}</td>,
                    <td key={`${p}i`} className="text-end">{inv.toLocaleString('en-IN')}</td>,
                  ]
                })}
              </tr>
            )
          })}
        </tbody>
      </Table>
    </div>
  )
}
