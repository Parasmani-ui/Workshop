import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Accordion, Nav, Table, Placeholder } from 'react-bootstrap'
import { useGameStore } from '@/store/gameStore'
import { reportApi } from '@/services/api'
import type { TeamReport } from '@/types/report.types'
import {
  formatAmount,
  formatSharePrice,
  formatRatio,
  formatPercent,
  formatCurrency,
} from '@/utils/formatters'
import StatCard from '@/components/common/StatCard'
import QuarterBadge from '@/components/common/QuarterBadge'

const EQUITY_FACE_VALUE = 10

interface RowProps {
  label: string
  value: number | string
  bold?: boolean
  indent?: number
  className?: string
  divider?: boolean
}

function Row({ label, value, bold, indent = 0, className = '', divider }: RowProps) {
  if (divider) {
    return (
      <tr>
        <td colSpan={2} className="p-0">
          <hr className="my-1" />
        </td>
      </tr>
    )
  }
  const weight = bold ? 'fw-bold' : ''
  const pad = { paddingLeft: `${indent * 16 + 8}px` }
  const isNumber = typeof value === 'number'
  const hasColorOverride = /text-(success|danger|warning|info|primary|muted)/.test(className)
  const negative = isNumber && value < 0 && !hasColorOverride
  const valueClass = `text-end ${weight} ${negative ? 'text-danger' : ''}`.trim()
  return (
    <tr className={className}>
      <td style={pad} className={weight}>
        {label}
      </td>
      <td className={valueClass}>
        {isNumber ? formatAmount(value) : value}
      </td>
    </tr>
  )
}

export default function MyReportsPage() {
  const { gameId: gameIdParam } = useParams<{ gameId: string }>()
  const { myTeamNo, currentGame, myGameId } = useGameStore()
  const gameId = gameIdParam ?? myGameId ?? ''

  const currentQuarter = currentGame?.currentQuarter ?? 1
  const availableQuarters = Math.max(1, currentQuarter)

  const [selectedQuarter, setSelectedQuarter] = useState(availableQuarters)
  const [report, setReport] = useState<TeamReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!gameId || myTeamNo === null || selectedQuarter < 1) return
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    setReport(null)
    reportApi
      .getTeamReport(gameId, myTeamNo, selectedQuarter)
      .then((res) => {
        if (cancelled) return
        setReport(res.data.data.report)
      })
      .catch(() => {
        if (cancelled) return
        setNotFound(true)
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [gameId, myTeamNo, selectedQuarter])

  const quarterTabs = Array.from({ length: availableQuarters }, (_, i) => i + 1)

  return (
    <div>
      <div className="bg-white rounded-3 shadow-sm p-3 mb-4">
        <div className="d-flex flex-wrap align-items-center gap-3">
          <h3 className="mb-0">Management Report</h3>
          <span className="badge bg-light text-dark border">Team {(myTeamNo ?? 0) + 1}</span>
          <QuarterBadge
            quarterNo={selectedQuarter}
            maxQuarters={currentGame?.maxQuarters ?? 5}
          />
          <div className="ms-auto small text-muted">{currentGame?.name ?? gameId}</div>
        </div>
      </div>

      <Nav variant="tabs" className="mb-3">
        {quarterTabs.map((q) => (
          <Nav.Item key={q}>
            <Nav.Link
              active={selectedQuarter === q}
              onClick={() => setSelectedQuarter(q)}
            >
              Q{q}
            </Nav.Link>
          </Nav.Item>
        ))}
      </Nav>

      {loading && <ReportSkeleton />}

      {!loading && notFound && (
        <div className="bg-white rounded-3 shadow-sm p-5 text-center text-muted">
          <div className="fs-5 mb-2">No report available for Q{selectedQuarter} yet.</div>
          <div className="small">
            Wait for the facilitator to process and publish results.
          </div>
        </div>
      )}

      {!loading && report && <ReportBody report={report} />}
    </div>
  )
}

function ReportSkeleton() {
  return (
    <div className="bg-white rounded-3 shadow-sm p-3">
      <Placeholder as="p" animation="glow">
        <Placeholder xs={8} />
        <Placeholder xs={10} />
        <Placeholder xs={6} />
        <Placeholder xs={9} />
        <Placeholder xs={7} />
      </Placeholder>
    </div>
  )
}

function ReportBody({ report }: { report: TeamReport }) {
  const { pandl, bsheet, saledata } = report

  const cogs = pandl.srev - pandl.gprofit
  const ebitda = pandl.gprofit - pandl.sadexp - pandl.randexp - pandl.bdebts - pandl.sdisc
  const ebit = ebitda - pandl.deprec
  const pbt = ebit - pandl.totfin
  const reserveTransfer = pandl.netinc - pandl.eqdiv - pandl.pdiv

  const shareCapital = bsheet.eshares * EQUITY_FACE_VALUE
  const totpref = bsheet.totpref ?? 0
  const sprem = bsheet.sprem ?? 0
  // Total equity = share capital at face value + retained earnings + securities premium.
  // bsheet.toteq from the server holds only the face-value component, so we
  // compose the full equity here for display.
  const totalEquityDisplay = bsheet.toteq + bsheet.retearn + sprem
  const totalLE = totalEquityDisplay + totpref + bsheet.totlnglib + bsheet.totcurlib

  const eps = bsheet.eshares > 0 ? pandl.netinc / bsheet.eshares : 0
  const netMargin = pandl.srev > 0 ? pandl.netinc / pandl.srev : 0
  const marketCap = pandl.esprice * bsheet.eshares

  const patClass = pandl.netinc >= 0 ? 'text-success' : 'text-danger'

  return (
    <Accordion defaultActiveKey={['0', '1', '2']} alwaysOpen>
      <Accordion.Item eventKey="0">
        <Accordion.Header>Income Statement (P&amp;L)</Accordion.Header>
        <Accordion.Body className="p-0">
          <Table hover size="sm" className="mb-0">
            <thead>
              <tr>
                <th>Item</th>
                <th className="text-end">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              <Row label="Sales Revenue" value={pandl.srev} />
              <Row divider label="" value="" />
              <Row label="Cost of Goods Sold" value={cogs} indent={1} />
              <Row divider label="" value="" />
              <Row label="GROSS PROFIT" value={pandl.gprofit} bold />
              <Row divider label="" value="" />
              <Row label="Less: S&A Expenses" value={pandl.sadexp} indent={1} />
              <Row label="Less: R&D Expenses" value={pandl.randexp} indent={1} />
              <Row label="Less: Bad Debts" value={pandl.bdebts} indent={1} />
              <Row label="Less: Cash Discounts" value={pandl.sdisc} indent={1} />
              <Row divider label="" value="" />
              <Row label="EBITDA" value={ebitda} />
              <Row label="Less: Depreciation" value={pandl.deprec} indent={1} />
              <Row label="EBIT" value={ebit} />
              <Row label="Less: Financial Costs" value={pandl.totfin} />
              <Row label="Term Loan Interest" value={pandl.tloanint} indent={2} />
              <Row label="Bond Interest" value={pandl.bondint} indent={2} />
              <Row label="STL Interest" value={pandl.stlint} indent={2} />
              <Row label="Shark Loan Interest" value={pandl.shkint} indent={2} />
              <Row divider label="" value="" />
              <Row label="PBT (Profit Before Tax)" value={pbt} />
              <Row label="Less: Income Tax" value={pandl.itax} indent={1} />
              <Row divider label="" value="" />
              <Row
                label="PAT (Profit After Tax)"
                value={pandl.netinc}
                bold
                className={patClass}
              />
              <Row divider label="" value="" />
              <Row label="Less: Equity Dividend" value={pandl.eqdiv} indent={1} />
              <Row label="Less: Preference Dividend" value={pandl.pdiv} indent={1} />
              <Row label="Transfer to Reserves" value={reserveTransfer} bold />
            </tbody>
          </Table>
        </Accordion.Body>
      </Accordion.Item>

      <Accordion.Item eventKey="1">
        <Accordion.Header>Balance Sheet</Accordion.Header>
        <Accordion.Body className="p-0">
          <Table hover size="sm" className="mb-0">
            <thead>
              <tr>
                <th>Item</th>
                <th className="text-end">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="table-light">
                <td colSpan={2} className="fw-bold text-uppercase small text-muted">
                  Assets
                </td>
              </tr>
              <tr>
                <td className="fw-semibold">Fixed Assets</td>
                <td></td>
              </tr>
              <Row label="Net Fixed Assets" value={bsheet.totfixast} indent={1} bold />
              <tr>
                <td className="fw-semibold">Current Assets</td>
                <td></td>
              </tr>
              <Row label="Cash & Bank" value={bsheet.cashhand} indent={1} />
              <Row label="Accounts Receivable" value={bsheet.arecble} indent={1} />
              <Row label="Inventories" value={bsheet.closeinv} indent={1} />
              <Row label="Total Current Assets" value={bsheet.totcurast} indent={1} bold />
              <Row divider label="" value="" />
              <Row label="TOTAL ASSETS" value={bsheet.totast} bold />

              <tr>
                <td colSpan={2} className="pt-3">
                  <hr className="my-1" />
                </td>
              </tr>
              <tr className="table-light">
                <td colSpan={2} className="fw-bold text-uppercase small text-muted">
                  Liabilities &amp; Equity
                </td>
              </tr>
              <tr>
                <td className="fw-semibold">Equity</td>
                <td></td>
              </tr>
              <Row label="Share Capital" value={shareCapital} indent={1} />
              <Row label="Retained Earnings" value={bsheet.retearn} indent={1} />
              {sprem > 0 && (
                <Row label="Securities Premium" value={sprem} indent={1} />
              )}
              <Row label="Total Equity" value={totalEquityDisplay} indent={1} bold />
              {totpref > 0 && (
                <>
                  <tr>
                    <td className="fw-semibold">Preference Capital</td>
                    <td></td>
                  </tr>
                  <Row label="Preference Shares" value={totpref} indent={1} bold />
                </>
              )}
              <tr>
                <td className="fw-semibold">Long-term Debt</td>
                <td></td>
              </tr>
              <Row label="2-Year Loans" value={bsheet.twyloans} indent={1} />
              <Row label="3-Year Loans" value={bsheet.thyloans} indent={1} />
              <Row label="Bonds" value={bsheet.bonds} indent={1} />
              <Row label="Total Long-term Debt" value={bsheet.totlnglib} indent={1} bold />
              <tr>
                <td className="fw-semibold">Current Liabilities</td>
                <td></td>
              </tr>
              <Row label="Total Current Liabilities" value={bsheet.totcurlib} indent={1} bold />
              <Row divider label="" value="" />
              <Row label="TOTAL LIABILITIES & EQUITY" value={totalLE} bold />
            </tbody>
          </Table>
        </Accordion.Body>
      </Accordion.Item>

      <Accordion.Item eventKey="2">
        <Accordion.Header>Key Metrics</Accordion.Header>
        <Accordion.Body>
          <div className="row g-3">
            <div className="col-md-4">
              <StatCard
                title="Share Price"
                value={formatSharePrice(pandl.esprice)}
                variant="primary"
              />
            </div>
            <div className="col-md-4">
              <StatCard
                title="EPS"
                value={formatSharePrice(eps)}
                variant={eps < 0 ? 'danger' : 'default'}
              />
            </div>
            <div className="col-md-4">
              <StatCard
                title="Current Ratio"
                value={formatRatio(bsheet.cratio)}
                variant={bsheet.cratio < 0 ? 'danger' : 'default'}
              />
            </div>
            <div className="col-md-4">
              <StatCard
                title="D/E Ratio"
                value={formatRatio(bsheet.de)}
                variant={bsheet.de < 0 ? 'danger' : 'default'}
              />
            </div>
            <div className="col-md-4">
              <StatCard
                title="Net Margin"
                value={formatPercent(netMargin)}
                variant={pandl.netinc >= 0 ? 'success' : 'danger'}
              />
            </div>
            <div className="col-md-4">
              <StatCard
                title="Market Cap"
                value={formatCurrency(marketCap)}
                variant="success"
              />
            </div>
          </div>
        </Accordion.Body>
      </Accordion.Item>

      <Accordion.Item eventKey="3">
        <Accordion.Header>Sales &amp; Inventory</Accordion.Header>
        <Accordion.Body className="p-0">
          <Table hover size="sm" className="mb-0">
            <thead>
              <tr>
                <th>Product</th>
                <th className="text-end">Ordered</th>
                <th className="text-end">Produced</th>
                <th className="text-end">Sold</th>
                <th className="text-end">Closing Inventory</th>
                <th className="text-end">Average Cost Price (₹)</th>
              </tr>
            </thead>
            <tbody>
              <SalesRow
                label="Product 1"
                ordered={saledata.ordbook1}
                produced={saledata.prod1}
                sold={saledata.sale1}
                closing={saledata.closeinv1}
                acp={pandl.acp1}
              />
              <SalesRow
                label="Product 2"
                ordered={saledata.ordbook2}
                produced={saledata.prod2}
                sold={saledata.sale2}
                closing={saledata.closeinv2}
                acp={pandl.acp2}
              />
              <SalesRow
                label="Product 3"
                ordered={saledata.ordbook3}
                produced={saledata.prod3}
                sold={saledata.sale3}
                closing={saledata.closeinv3}
                acp={pandl.acp3}
              />
              <SalesRow
                label="Product 4"
                ordered={saledata.ordbook4}
                produced={saledata.prod4}
                sold={saledata.sale4}
                closing={saledata.closeinv4}
                acp={pandl.acp4}
              />
              <SalesRow
                label="Raw Material X"
                sold={saledata.rawx}
                acp={saledata.wax}
                rowClass="table-light"
              />
              <SalesRow
                label="Raw Material Y"
                sold={saledata.rawy}
                acp={saledata.way}
                rowClass="table-light"
              />
            </tbody>
          </Table>
        </Accordion.Body>
      </Accordion.Item>
    </Accordion>
  )
}

interface SalesRowProps {
  label: string
  ordered?: number
  produced?: number
  sold?: number
  closing?: number
  acp: number
  rowClass?: string
}

function SalesRow({
  label,
  ordered,
  produced,
  sold,
  closing,
  acp,
  rowClass = '',
}: SalesRowProps) {
  const cell = (v: number | undefined, decimals = 0) => {
    if (v === undefined) return <span>—</span>
    const cls = v < 0 ? 'text-danger' : ''
    return <span className={cls}>{formatAmount(v, decimals)}</span>
  }
  return (
    <tr className={rowClass}>
      <td>{label}</td>
      <td className="text-end">{cell(ordered)}</td>
      <td className="text-end">{cell(produced)}</td>
      <td className="text-end">{cell(sold)}</td>
      <td className="text-end">{cell(closing)}</td>
      <td className="text-end">{cell(acp, 2)}</td>
    </tr>
  )
}
