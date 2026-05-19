import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import { useUIStore } from '@/store/uiStore'
import { useSocket } from '@/hooks/useSocket'
import { decisionApi, gameApi, reportApi, teamApi } from '@/services/api'
import { formatCurrency } from '@/utils/formatters'
import type { Decision } from '@/types/decision.types'
import type { Scenario } from '@/types/game.types'
import type { TeamReport } from '@/types/report.types'

type TabKey = 'production' | 'marketing' | 'finance' | 'rnd' | 'submit'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'production', label: 'Production & RM' },
  { key: 'marketing', label: 'Marketing (S&A)' },
  { key: 'finance', label: 'Finance' },
  { key: 'rnd', label: 'R&D & Capacity' },
  { key: 'submit', label: 'Message & Submit' },
]

const DEFAULT_PRODUCT_NAMES = ['AquaFort', 'Diet', 'Elixir', 'Energy']
const DEFAULT_RM_NAMES = ['Water', 'Add']

function emptyDecision(gameId: string, teamNo: number, quarterNo: number): Decision {
  return {
    gameId,
    teamNo,
    quarterNo,
    prod1: 0, prod2: 0, prod3: 0, prod4: 0,
    price1: 0, price2: 0, price3: 0, price4: 0,
    raw1: 0, raw2: 0,
    fsad1: 0, fsad2: 0, fsad3: 0, fsad4: 0,
    vsad1: 0, vsad2: 0, vsad3: 0, vsad4: 0,
    dscnt1: 0, dscnt2: 0, dscnt3: 0, dscnt4: 0,
    newPCap: 0, newMCap: 0,
    stl: 0, ntwLoan: 0, nthLoan: 0, nBond: 0,
    equDiv: 0, equNo: 0, equPri: 0,
    prefNo: 0, prefPri: 0,
    rand1: 0, rand2: 0,
    mesage: '',
    strset: 0,
    bdisc: 0,
    train1: 0, train2: 0, train3: 0, train4: 0,
    isLocked: false,
  }
}

export default function DecisionEntryPage() {
  const { gameId = '' } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const { currentGame, teams, myTeamNo, setGame, setTeams } = useGameStore()
  const { addNotification } = useUIStore()

  useSocket(gameId)

  const teamNo = myTeamNo ?? 0
  const quarterNo = currentGame?.currentQuarter ?? 1
  const storageKey = `decision_${gameId}_Q${quarterNo}`

  const [activeTab, setActiveTab] = useState<TabKey>('production')
  const [decision, setDecision] = useState<Decision>(() =>
    emptyDecision(gameId, teamNo, quarterNo)
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<
    { type: 'success' | 'error'; message: string } | null
  >(null)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [alreadySubmitted, setAlreadySubmitted] = useState(false)
  /**
   * The previous quarter's published report for this team. Used by the
   * decision validator to compute usable capacity (prev.maccap + prev.newmcap),
   * opening RM (prev.crawin1/2), and the RM purchase ceiling
   * (prev.rawx × (1 + rm1lim)). Null while loading or when no prior quarter
   * exists (Q1 with no Q0 seed).
   */
  const [prevReport, setPrevReport] = useState<TeamReport | null>(null)
  const hydratedRef = useRef(false)

  // Always re-fetch game on mount so stale state can't make a team submit
  // for a quarter the facilitator has already moved past.
  useEffect(() => {
    if (!gameId) return
    gameApi
      .get(gameId)
      .then((res) => setGame(res.data.data.game))
      .catch((err) => addNotification('error', err.message))
  }, [gameId, setGame, addNotification])

  // Check whether this team has already submitted for the current quarter.
  // If so, the form stays locked until the facilitator publishes results
  // (which advances currentQuarter and clears this check for the next Q).
  useEffect(() => {
    if (!gameId || quarterNo < 1 || myTeamNo === null) {
      setAlreadySubmitted(false)
      return
    }
    decisionApi
      .getOne(gameId, teamNo, quarterNo)
      .then((res) => {
        setAlreadySubmitted(!!res.data.data.decision?.submittedAt)
      })
      .catch(() => setAlreadySubmitted(false))
  }, [gameId, teamNo, quarterNo, myTeamNo])

  // Fetch teams if not loaded
  useEffect(() => {
    if (!gameId) return
    if (teams.length > 0 && teams[0]?.gameId === gameId) return
    teamApi
      .list(gameId)
      .then((res) => setTeams(res.data.data.teams))
      .catch((err) => addNotification('error', err.message))
  }, [gameId, teams, setTeams, addNotification])

  // Hydrate from localStorage or previous quarter on mount / quarter change
  useEffect(() => {
    if (!gameId) return
    hydratedRef.current = false
    const raw = localStorage.getItem(storageKey)
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Decision
        setDecision({ ...parsed, gameId, teamNo, quarterNo })
        hydratedRef.current = true
        return
      } catch {
        /* fall through */
      }
    }
    // Try previous quarter draft as seed
    if (quarterNo > 1) {
      decisionApi
        .getOne(gameId, teamNo, quarterNo - 1)
        .then((res) => {
          const prev = res.data.data.decision
          setDecision({
            ...prev,
            gameId,
            teamNo,
            quarterNo,
            isLocked: false,
            submittedAt: undefined,
          })
          hydratedRef.current = true
        })
        .catch(() => {
          setDecision(emptyDecision(gameId, teamNo, quarterNo))
          hydratedRef.current = true
        })
    } else {
      setDecision(emptyDecision(gameId, teamNo, quarterNo))
      hydratedRef.current = true
    }
  }, [gameId, teamNo, quarterNo, storageKey])

  // Auto-save to localStorage every 30 seconds
  useEffect(() => {
    if (!gameId) return
    const interval = setInterval(() => {
      if (!hydratedRef.current) return
      localStorage.setItem(storageKey, JSON.stringify(decision))
      const now = new Date()
      setLastSaved(
        `${now.getHours().toString().padStart(2, '0')}:${now
          .getMinutes()
          .toString()
          .padStart(2, '0')}`
      )
    }, 30_000)
    return () => clearInterval(interval)
  }, [decision, storageKey, gameId])

  const scenario =
    currentGame && typeof currentGame.scenarioId === 'object'
      ? (currentGame.scenarioId as Scenario)
      : null

  const productNames = scenario?.productNames?.length
    ? scenario.productNames
    : DEFAULT_PRODUCT_NAMES
  const rm1Name = scenario?.rm1Name ?? DEFAULT_RM_NAMES[0]
  const rm2Name = scenario?.rm2Name ?? DEFAULT_RM_NAMES[1]

  const myTeam = teams.find((t) => t.teamNo === teamNo)
  const gameStatus = currentGame?.status
  const isLocked =
    decision.isLocked ||
    alreadySubmitted ||
    gameStatus !== 'active'

  let lockedReason = ''
  if (alreadySubmitted) {
    lockedReason = `Decisions already submitted for Q${quarterNo}. Waiting for facilitator to publish results.`
  } else if (gameStatus === 'processing') {
    lockedReason = 'Quarter locked by facilitator — submissions closed.'
  } else if (gameStatus === 'completed') {
    lockedReason = 'Game completed.'
  } else if (gameStatus === 'setup') {
    lockedReason = 'Game has not started yet.'
  }

  const totals = useMemo(() => {
    const prices = [decision.price1, decision.price2, decision.price3, decision.price4]
    const prods = [decision.prod1, decision.prod2, decision.prod3, decision.prod4]
    const revenue = prods.reduce((sum, p, i) => sum + p * prices[i], 0)
    const rmCost = decision.raw1 * 10 + decision.raw2 * 8 // rough estimate
    const saTotal =
      decision.fsad1 + decision.fsad2 + decision.fsad3 + decision.fsad4 +
      decision.vsad1 + decision.vsad2 + decision.vsad3 + decision.vsad4
    const financeTotal =
      decision.stl + decision.ntwLoan + decision.nthLoan + decision.nBond +
      decision.equNo * decision.equPri + decision.prefNo * decision.prefPri
    const totalProd = prods.reduce((a, b) => a + b, 0)
    const totalRM = decision.raw1 + decision.raw2
    return { revenue, rmCost, saTotal, financeTotal, totalProd, totalRM }
  }, [decision])

  // Fetch the previous quarter's published report so the validator below
  // knows this team's starting capacity, opening RM, and purchase ceiling.
  // Q1 reads from Q0 (seeded on game activation); Q2+ reads from Q[N-1].
  useEffect(() => {
    if (!gameId || quarterNo < 1) return
    let cancelled = false
    reportApi
      .getTeamReport(gameId, teamNo, quarterNo - 1)
      .then((res) => {
        if (!cancelled) setPrevReport(res.data.data.report)
      })
      .catch(() => {
        if (!cancelled) setPrevReport(null)
      })
    return () => {
      cancelled = true
    }
  }, [gameId, teamNo, quarterNo])

  /**
   * Pre-submission validator — surfaces capacity / RM-recipe / RM-purchase
   * constraints to the team while they're still editing decisions. Mirrors
   * the engine's ProductionModule logic so what the team sees here is what
   * the engine will actually do on process.
   */
  const validations = useMemo(() => {
    const warnings: { level: 'warn' | 'info'; text: string }[] = []
    if (!prevReport || !scenario?.gameaid) return warnings

    const cap = prevReport.captab
    const sale = prevReport.saledata
    const gameaid = scenario.gameaid
    const forecast = scenario.forecast?.find((f) => f.quarterNo === quarterNo)

    const prods = [decision.prod1, decision.prod2, decision.prod3, decision.prod4]
    const totalProd = prods.reduce((a, b) => a + b, 0)

    // 1. Capacity check
    // Active capacity this quarter = prev active + prev new orders (1Q lead).
    if (cap) {
      const usableCap = Math.min(
        (cap.maccap || 0) + (cap.newmcap || 0),
        (cap.placap || 0) + (cap.newpcap || 0),
      )
      if (totalProd > usableCap && usableCap > 0) {
        const scaledPct = ((usableCap / totalProd) * 100).toFixed(0)
        warnings.push({
          level: 'warn',
          text:
            `Production decisions total ${totalProd.toLocaleString()} units but ` +
            `your usable capacity is only ${usableCap.toLocaleString()} ` +
            `(min of plant + machine). The engine will scale every product ` +
            `down to ~${scaledPct}% of what you ordered.`,
        })
      } else if (totalProd > 0 && usableCap === 0) {
        warnings.push({
          level: 'warn',
          text:
            'You have zero active capacity this quarter. New plant/machine ' +
            'ordered now activates next quarter — production will be 0.',
        })
      }
    }

    // 2. RM purchase ceiling check
    const prevRaw1 = sale?.rawx ?? 0
    const prevRaw2 = sale?.rawy ?? 0
    const rm1lim = forecast?.rm1lim ?? 0
    const rm2lim = forecast?.rm2lim ?? 0
    const maxRaw1 = prevRaw1 > 0 ? prevRaw1 * (1 + rm1lim) : Infinity
    const maxRaw2 = prevRaw2 > 0 ? prevRaw2 * (1 + rm2lim) : Infinity
    if (decision.raw1 > maxRaw1 && Number.isFinite(maxRaw1)) {
      warnings.push({
        level: 'warn',
        text:
          `${rm1Name} order ${decision.raw1.toLocaleString()} exceeds the ` +
          `purchase ceiling (${Math.floor(maxRaw1).toLocaleString()} = ` +
          `prev quarter's ${prevRaw1.toLocaleString()} × (1 + ${(rm1lim * 100).toFixed(0)}%)). ` +
          `The engine will cap it at ${Math.floor(maxRaw1).toLocaleString()}.`,
      })
    }
    if (decision.raw2 > maxRaw2 && Number.isFinite(maxRaw2)) {
      warnings.push({
        level: 'warn',
        text:
          `${rm2Name} order ${decision.raw2.toLocaleString()} exceeds the ` +
          `purchase ceiling (${Math.floor(maxRaw2).toLocaleString()} = ` +
          `prev quarter's ${prevRaw2.toLocaleString()} × (1 + ${(rm2lim * 100).toFixed(0)}%)). ` +
          `The engine will cap it at ${Math.floor(maxRaw2).toLocaleString()}.`,
      })
    }

    // 3. RM recipe vs available RM — checked AFTER capacity scaling, since
    //    that's what the engine actually consumes.
    const effRaw1 = Math.min(decision.raw1, maxRaw1)
    const effRaw2 = Math.min(decision.raw2, maxRaw2)
    const openRM1 = sale?.crawin1 ?? 0
    const openRM2 = sale?.crawin2 ?? 0
    const availRM1 = openRM1 + effRaw1
    const availRM2 = openRM2 + effRaw2

    const rm1Recipe = [gameaid.rm11, gameaid.rm12, gameaid.rm13, gameaid.rm14]
    const rm2Recipe = [gameaid.rm21, gameaid.rm22, gameaid.rm23, gameaid.rm24]
    const usableCap = cap
      ? Math.min(
          (cap.maccap || 0) + (cap.newmcap || 0),
          (cap.placap || 0) + (cap.newpcap || 0),
        )
      : Infinity
    const scale =
      totalProd > usableCap && totalProd > 0 ? usableCap / totalProd : 1
    const rm1Needed = prods.reduce(
      (sum, p, i) => sum + Math.floor(p * scale) * (rm1Recipe[i] ?? 0),
      0,
    )
    const rm2Needed = prods.reduce(
      (sum, p, i) => sum + Math.floor(p * scale) * (rm2Recipe[i] ?? 0),
      0,
    )

    if (rm1Needed > availRM1 && totalProd > 0) {
      warnings.push({
        level: 'warn',
        text:
          `Recipe needs ${rm1Needed.toLocaleString()} ${rm1Name} but you only ` +
          `have ${availRM1.toLocaleString()} available ` +
          `(opening ${openRM1.toLocaleString()} + buying ${Math.floor(effRaw1).toLocaleString()}). ` +
          `Products are filled in P1→P2→P3→P4 order; the later ones will be starved.`,
      })
    }
    if (rm2Needed > availRM2 && totalProd > 0) {
      warnings.push({
        level: 'warn',
        text:
          `Recipe needs ${rm2Needed.toLocaleString()} ${rm2Name} but you only ` +
          `have ${availRM2.toLocaleString()} available ` +
          `(opening ${openRM2.toLocaleString()} + buying ${Math.floor(effRaw2).toLocaleString()}). ` +
          `Products are filled in P1→P2→P3→P4 order; the later ones will be starved.`,
      })
    }

    // 4. "Did you forget production?" nudge
    if (totalProd === 0 && (decision.raw1 > 0 || decision.raw2 > 0)) {
      warnings.push({
        level: 'info',
        text:
          'You ordered raw materials but no production quantities — RM will ' +
          'sit in inventory at quarter end (and warehouse costs apply).',
      })
    }

    return warnings
  }, [prevReport, scenario, decision, quarterNo, rm1Name, rm2Name])

  function updateField<K extends keyof Decision>(key: K, value: Decision[K]) {
    setDecision((prev) => ({ ...prev, [key]: value }))
  }

  function numField<K extends keyof Decision>(
    key: K,
    label: string,
    step = 1,
    hint?: string
  ) {
    return (
      <div className="mb-3">
        <label className="form-label small fw-semibold">{label}</label>
        <input
          type="number"
          min={0}
          step={step}
          className="form-control"
          value={decision[key] as number}
          onChange={(e) =>
            updateField(key, (Number(e.target.value) || 0) as Decision[K])
          }
          disabled={isLocked}
        />
        {hint && <div className="form-text small">{hint}</div>}
      </div>
    )
  }

  async function handleSubmit() {
    if (isLocked) return
    setIsSubmitting(true)
    setSubmitStatus(null)
    try {
      await decisionApi.submit(gameId, { ...decision, gameId, teamNo, quarterNo })
      setSubmitStatus({
        type: 'success',
        message: `Decisions submitted for Q${quarterNo}. Returning to dashboard...`,
      })
      addNotification('success', `Q${quarterNo} decisions submitted`)
      localStorage.removeItem(storageKey)
      setAlreadySubmitted(true)
      setTimeout(() => navigate('/team'), 1200)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Submission failed'
      setSubmitStatus({ type: 'error', message })
      addNotification('error', message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="pb-5">
      <div className="d-flex justify-content-between align-items-start mb-3">
        <div>
          <h2 className="mb-1">Quarter {quarterNo} Decision Form</h2>
          <div className="text-muted">
            {currentGame?.name ?? gameId}
            {myTeam && ` • Team ${teamNo} — ${myTeam.teamName}`}
          </div>
        </div>
        {lastSaved && (
          <small className="text-muted">Last saved: {lastSaved}</small>
        )}
      </div>

      {isLocked && (
        <div className="alert alert-warning">
          {lockedReason || 'Quarter locked — submissions closed'}
        </div>
      )}

      {submitStatus && (
        <div
          className={`alert alert-${
            submitStatus.type === 'success' ? 'success' : 'danger'
          }`}
        >
          {submitStatus.message}
        </div>
      )}

      <ul className="nav nav-tabs mb-3">
        {TABS.map((tab) => (
          <li className="nav-item" key={tab.key}>
            <button
              type="button"
              className={`nav-link ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          </li>
        ))}
      </ul>

      <div className="card">
        <div className="card-body">
          {activeTab === 'production' && (
            <ProductionTab
              decision={decision}
              productNames={productNames}
              rm1Name={rm1Name}
              rm2Name={rm2Name}
              isLocked={isLocked}
              updateField={updateField}
              rmCostEstimate={totals.rmCost}
              validations={validations}
            />
          )}

          {activeTab === 'marketing' && (
            <MarketingTab
              decision={decision}
              productNames={productNames}
              isLocked={isLocked}
              updateField={updateField}
              saTotal={totals.saTotal}
            />
          )}

          {activeTab === 'finance' && (
            <div className="row">
              <div className="col-md-6">
                <h5 className="mb-3">Loans</h5>
                {numField('stl', 'Short-Term Loan (₹)')}
                {numField('ntwLoan', '2-Year Loan (₹)')}
                {numField('nthLoan', '3-Year Loan (₹)')}
                {numField('nBond', 'New Bonds (₹)')}
              </div>
              <div className="col-md-6">
                <h5 className="mb-3">Equity</h5>
                {numField('equNo', 'New Shares to Issue')}
                {numField('equPri', 'Issue Price (₹)', 0.5)}
                {numField('equDiv', 'Equity Dividend per Share (₹)', 0.5)}

                <h5 className="mt-4 mb-3">Preference Shares</h5>
                {numField('prefNo', 'Preferred Shares to Issue')}
                {numField('prefPri', 'Preference Issue Price (₹)', 0.5)}
              </div>
            </div>
          )}

          {activeTab === 'rnd' && (
            <div className="row">
              <div className="col-md-6">
                <h5 className="mb-3">R&D Investment</h5>
                {numField('rand1', 'R&D Type 1 — Image / Product (₹)')}
                {numField('rand2', 'R&D Type 2 — RM Reduction (₹)')}

                <h5 className="mt-4 mb-3">Capacity Expansion</h5>
                {numField(
                  'newPCap',
                  'New Plant Capacity (units)',
                  1,
                  '2 quarter lead time'
                )}
                {numField(
                  'newMCap',
                  'New Machine Capacity (units)',
                  1,
                  '1 quarter lead time'
                )}
              </div>
              <div className="col-md-6">
                <h5 className="mb-3">Training Projects</h5>
                {numField('train1', `Project 1 — ${productNames[0]}`)}
                {numField('train2', `Project 2 — ${productNames[1]}`)}
                {numField('train3', `Project 3 — ${productNames[2]}`)}
                {numField('train4', `Project 4 — ${productNames[3]}`)}
              </div>
            </div>
          )}

          {activeTab === 'submit' && (
            <SubmitTab
              decision={decision}
              totals={totals}
              isLocked={isLocked}
              isSubmitting={isSubmitting}
              quarterNo={quarterNo}
              updateField={updateField}
              onSubmit={handleSubmit}
            />
          )}
        </div>
      </div>

      <div
        className="position-fixed bottom-0 start-0 end-0 bg-dark text-light py-2 px-4 shadow-lg"
        style={{ zIndex: 1000 }}
      >
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
          <span>
            <strong>Revenue Est:</strong> {formatCurrency(totals.revenue)}
          </span>
          <span>
            <strong>RM Cost:</strong> {formatCurrency(totals.rmCost)}
          </span>
          <span>
            <strong>S&A Total:</strong> {formatCurrency(totals.saTotal)}
          </span>
          <span>
            <strong>Status:</strong>{' '}
            {isLocked
              ? 'Locked'
              : submitStatus?.type === 'success'
                ? 'Submitted'
                : 'Draft'}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Production & RM Tab ──────────────────────────────────────────────

interface ProductionTabProps {
  decision: Decision
  productNames: string[]
  rm1Name: string
  rm2Name: string
  isLocked: boolean
  updateField: <K extends keyof Decision>(key: K, value: Decision[K]) => void
  rmCostEstimate: number
  validations: { level: 'warn' | 'info'; text: string }[]
}

function ProductionTab({
  decision,
  productNames,
  rm1Name,
  rm2Name,
  isLocked,
  updateField,
  rmCostEstimate,
  validations,
}: ProductionTabProps) {
  const prodKeys = ['prod1', 'prod2', 'prod3', 'prod4'] as const
  const priceKeys = ['price1', 'price2', 'price3', 'price4'] as const

  return (
    <>
      {validations.length > 0 && (
        <div className="mb-3">
          {validations.map((v, i) => (
            <div
              key={i}
              className={`alert alert-${v.level === 'warn' ? 'warning' : 'info'} py-2 small mb-2`}
              role="alert"
            >
              {v.level === 'warn' ? '⚠ ' : 'ℹ️ '}{v.text}
            </div>
          ))}
        </div>
      )}

      <h5 className="mb-3">Production Quantities</h5>
      <div className="table-responsive mb-4">
        <table className="table table-sm align-middle">
          <thead>
            <tr>
              <th>Product</th>
              <th>Production Units</th>
              <th>Selling Price (₹)</th>
              <th>Est. Revenue</th>
            </tr>
          </thead>
          <tbody>
            {productNames.slice(0, 4).map((name, i) => {
              const units = decision[prodKeys[i]]
              const price = decision[priceKeys[i]]
              return (
                <tr key={i}>
                  <td className="fw-semibold">{name}</td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      className="form-control form-control-sm"
                      value={units}
                      onChange={(e) =>
                        updateField(prodKeys[i], Number(e.target.value) || 0)
                      }
                      disabled={isLocked}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      className="form-control form-control-sm"
                      value={price}
                      onChange={(e) =>
                        updateField(priceKeys[i], Number(e.target.value) || 0)
                      }
                      disabled={isLocked}
                    />
                  </td>
                  <td className="text-muted">{formatCurrency(units * price)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <h5 className="mb-3">Raw Materials</h5>
      <div className="row">
        <div className="col-md-6">
          <label className="form-label small fw-semibold">{rm1Name} — Quantity</label>
          <input
            type="number"
            min={0}
            step={1}
            className="form-control"
            value={decision.raw1}
            onChange={(e) => updateField('raw1', Number(e.target.value) || 0)}
            disabled={isLocked}
          />
        </div>
        <div className="col-md-6">
          <label className="form-label small fw-semibold">{rm2Name} — Quantity</label>
          <input
            type="number"
            min={0}
            step={1}
            className="form-control"
            value={decision.raw2}
            onChange={(e) => updateField('raw2', Number(e.target.value) || 0)}
            disabled={isLocked}
          />
        </div>
      </div>
      <div className="mt-3 text-muted">
        Estimated RM Cost: <strong>{formatCurrency(rmCostEstimate)}</strong>
      </div>
    </>
  )
}

// ─── Marketing Tab ─────────────────────────────────────────────────────

interface MarketingTabProps {
  decision: Decision
  productNames: string[]
  isLocked: boolean
  updateField: <K extends keyof Decision>(key: K, value: Decision[K]) => void
  saTotal: number
}

function MarketingTab({
  decision,
  productNames,
  isLocked,
  updateField,
  saTotal,
}: MarketingTabProps) {
  const fsadKeys = ['fsad1', 'fsad2', 'fsad3', 'fsad4'] as const
  const vsadKeys = ['vsad1', 'vsad2', 'vsad3', 'vsad4'] as const
  const dscntKeys = ['dscnt1', 'dscnt2', 'dscnt3', 'dscnt4'] as const

  return (
    <>
      <div className="table-responsive">
        <table className="table table-sm align-middle">
          <thead>
            <tr>
              <th>Product</th>
              <th>Fixed S&A (₹)</th>
              <th>Variable S&A (₹)</th>
              <th>Cash Discount (%)</th>
            </tr>
          </thead>
          <tbody>
            {productNames.slice(0, 4).map((name, i) => (
              <tr key={i}>
                <td className="fw-semibold">{name}</td>
                <td>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    className="form-control form-control-sm"
                    value={decision[fsadKeys[i]]}
                    onChange={(e) =>
                      updateField(fsadKeys[i], Number(e.target.value) || 0)
                    }
                    disabled={isLocked}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    className="form-control form-control-sm"
                    value={decision[vsadKeys[i]]}
                    onChange={(e) =>
                      updateField(vsadKeys[i], Number(e.target.value) || 0)
                    }
                    disabled={isLocked}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    className="form-control form-control-sm"
                    value={decision[dscntKeys[i]]}
                    onChange={(e) =>
                      updateField(dscntKeys[i], Number(e.target.value) || 0)
                    }
                    disabled={isLocked}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-end">
        Total S&A Spend: <strong>{formatCurrency(saTotal)}</strong>
      </div>
    </>
  )
}

// ─── Submit Tab ────────────────────────────────────────────────────────

interface SubmitTabProps {
  decision: Decision
  totals: {
    revenue: number
    rmCost: number
    saTotal: number
    financeTotal: number
    totalProd: number
    totalRM: number
  }
  isLocked: boolean
  isSubmitting: boolean
  quarterNo: number
  updateField: <K extends keyof Decision>(key: K, value: Decision[K]) => void
  onSubmit: () => void
}

function SubmitTab({
  decision,
  totals,
  isLocked,
  isSubmitting,
  quarterNo,
  updateField,
  onSubmit,
}: SubmitTabProps) {
  return (
    <>
      <h5 className="mb-3">Quarter Summary</h5>
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="p-3 border rounded">
            <div className="small text-muted">Total Production</div>
            <div className="h5 mb-0">{totals.totalProd.toLocaleString()}</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="p-3 border rounded">
            <div className="small text-muted">Total RM Purchase</div>
            <div className="h5 mb-0">{totals.totalRM.toLocaleString()}</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="p-3 border rounded">
            <div className="small text-muted">Total S&A</div>
            <div className="h5 mb-0">{formatCurrency(totals.saTotal)}</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="p-3 border rounded">
            <div className="small text-muted">Total Finance</div>
            <div className="h5 mb-0">{formatCurrency(totals.financeTotal)}</div>
          </div>
        </div>
      </div>

      <div className="mb-3">
        <label className="form-label small fw-semibold">
          Message to Facilitator
        </label>
        <textarea
          className="form-control"
          rows={3}
          maxLength={200}
          value={decision.mesage}
          onChange={(e) => updateField('mesage', e.target.value)}
          disabled={isLocked}
        />
        <div className="form-text">{decision.mesage.length}/200</div>
      </div>

      <div className="row">
        <div className="col-md-6 mb-3">
          <label className="form-label small fw-semibold">Strike Settlement</label>
          <select
            className="form-select"
            value={decision.strset}
            onChange={(e) => updateField('strset', Number(e.target.value))}
            disabled={isLocked}
          >
            <option value={0}>0 — No action</option>
            <option value={1}>1 — Accept settlement</option>
          </select>
        </div>
        <div className="col-md-6 mb-3">
          <label className="form-label small fw-semibold">Bills Discounting (₹)</label>
          <input
            type="number"
            min={0}
            step={1}
            className="form-control"
            value={decision.bdisc}
            onChange={(e) => updateField('bdisc', Number(e.target.value) || 0)}
            disabled={isLocked}
          />
        </div>
      </div>

      <button
        type="button"
        className="btn btn-primary btn-lg w-100 mt-3"
        onClick={onSubmit}
        disabled={isLocked || isSubmitting}
      >
        {isSubmitting ? (
          <>
            <span
              className="spinner-border spinner-border-sm me-2"
              role="status"
              aria-hidden="true"
            />
            Submitting…
          </>
        ) : (
          `Submit Q${quarterNo} Decisions`
        )}
      </button>
    </>
  )
}
