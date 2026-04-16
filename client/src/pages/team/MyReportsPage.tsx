import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Accordion, Nav, Table, Placeholder } from 'react-bootstrap'
import { useGameStore } from '@/store/gameStore'
import { reportApi } from '@/services/api'
import type { TeamReport } from '@/types/report.types'
import {
  formatCurrencyFull,
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
  return (
    <tr className={className}>
      <td style={pad} className={weight}>
        {label}
      </td>
      <td className={`text-end ${weight}`}>
        {typeof value === 'number' ? formatCurrencyFull(value) : value}
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

  const grossBlock = 0 // plant/macery not in current type; fall back to gross fixed assets
  const totalLE = bsheet.toteq + bsheet.totlnglib + bsheet.totcurlib
  const shareCapital = bsheet.eshares * EQUITY_FACE_VALUE

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
        <Accordion.Body>
          <div className="row g-3">
            <div className="col-md-6">
              <h6 className="text-muted text-uppercase small">Assets</h6>
              <Table hover size="sm">
                <tbody>
                  <tr>
                    <td className="fw-semibold">Fixed Assets</td>
                    <td></td>
                  </tr>
                  <Row label="Gross Block" value={grossBlock} indent={1} />
                  <Row
                    label="Less: Accumulated Depreciation"
                    value={0}
                    indent={1}
                  />
                  <Row label="NET FIXED ASSETS" value={bsheet.totfixast} bold />
                  <tr>
                    <td className="fw-semibold">Current Assets</td>
                    <td></td>
                  </tr>
                  <Row label="Cash & Bank" value={bsheet.cashhand} indent={1} />
                  <Row label="Accounts Receivable" value={bsheet.arecble} indent={1} />
                  <Row label="Inventories" value={bsheet.closeinv} indent={1} />
                  <Row label="TOTAL CURRENT ASSETS" value={bsheet.totcurast} bold />
                  <Row divider label="" value="" />
                  <Row label="TOTAL ASSETS" value={bsheet.totast} bold />
                </tbody>
              </Table>
            </div>
            <div className="col-md-6">
              <h6 className="text-muted text-uppercase small">Liabilities &amp; Equity</h6>
              <Table hover size="sm">
                <tbody>
                  <tr>
                    <td className="fw-semibold">Equity</td>
                    <td></td>
                  </tr>
                  <Row label="Share Capital" value={shareCapital} indent={1} />
                  <Row label="Retained Earnings" value={bsheet.retearn} indent={1} />
                  <Row label="TOTAL EQUITY" value={bsheet.toteq} bold />
                  <tr>
                    <td className="fw-semibold">Long-term Debt</td>
                    <td></td>
                  </tr>
                  <Row label="2-Year Loans" value={bsheet.twyloans} indent={1} />
                  <Row label="3-Year Loans" value={bsheet.thyloans} indent={1} />
                  <Row label="Bonds" value={bsheet.bonds} indent={1} />
                  <Row label="TOTAL LT DEBT" value={bsheet.totlnglib} bold />
                  <tr>
                    <td className="fw-semibold">Current Liabilities</td>
                    <td></td>
                  </tr>
                  <Row
                    label="TOTAL CURRENT LIABILITIES"
                    value={bsheet.totcurlib}
                    bold
                  />
                  <Row divider label="" value="" />
                  <Row label="TOTAL L + E" value={totalLE} bold />
                </tbody>
              </Table>
            </div>
          </div>
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
              <StatCard title="EPS" value={formatSharePrice(eps)} />
            </div>
            <div className="col-md-4">
              <StatCard
                title="Current Ratio"
                value={formatRatio(bsheet.cratio)}
              />
            </div>
            <div className="col-md-4">
              <StatCard title="D/E Ratio" value={formatRatio(bsheet.de)} />
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
                <th className="text-end">Closing Inv</th>
                <th className="text-end">ACP (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Product 1</td>
                <td className="text-end">{saledata.ordbook1}</td>
                <td className="text-end">{saledata.prod1}</td>
                <td className="text-end">{saledata.sale1}</td>
                <td className="text-end">{saledata.closeinv1}</td>
                <td className="text-end">{formatSharePrice(pandl.acp1)}</td>
              </tr>
              <tr>
                <td>Product 2</td>
                <td className="text-end">{saledata.ordbook2}</td>
                <td className="text-end">{saledata.prod2}</td>
                <td className="text-end">{saledata.sale2}</td>
                <td className="text-end">{saledata.closeinv2}</td>
                <td className="text-end">{formatSharePrice(pandl.acp2)}</td>
              </tr>
              <tr>
                <td>Product 3</td>
                <td className="text-end">{saledata.ordbook3}</td>
                <td className="text-end">{saledata.prod3}</td>
                <td className="text-end">{saledata.sale3}</td>
                <td className="text-end">{saledata.closeinv3}</td>
                <td className="text-end">{formatSharePrice(pandl.acp3)}</td>
              </tr>
              <tr>
                <td>Product 4</td>
                <td className="text-end">{saledata.ordbook4}</td>
                <td className="text-end">{saledata.prod4}</td>
                <td className="text-end">{saledata.sale4}</td>
                <td className="text-end">{saledata.closeinv4}</td>
                <td className="text-end">{formatSharePrice(pandl.acp4)}</td>
              </tr>
              <tr className="table-light">
                <td>Raw Material X</td>
                <td className="text-end">—</td>
                <td className="text-end">—</td>
                <td className="text-end">{saledata.rawx}</td>
                <td className="text-end">—</td>
                <td className="text-end">{formatSharePrice(saledata.wax)}</td>
              </tr>
              <tr className="table-light">
                <td>Raw Material Y</td>
                <td className="text-end">—</td>
                <td className="text-end">—</td>
                <td className="text-end">{saledata.rawy}</td>
                <td className="text-end">—</td>
                <td className="text-end">{formatSharePrice(saledata.way)}</td>
              </tr>
            </tbody>
          </Table>
        </Accordion.Body>
      </Accordion.Item>
    </Accordion>
  )
}
