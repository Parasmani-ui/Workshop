import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Form, Spinner } from 'react-bootstrap'
import { useGame } from '@/hooks/useGame'
import { useSocket } from '@/hooks/useSocket'
import { useGameStore } from '@/store/gameStore'
import { useUIStore } from '@/store/uiStore'
import { gameApi, decisionApi, reportApi } from '@/services/api'
import { socketEvents } from '@/services/socket'
import type { Decision } from '@/types/decision.types'
import { WIN_CRITERIA_LABELS } from '@/types/game.types'
import QuarterBadge from '@/components/common/QuarterBadge'
import TeamStatusGrid from '@/components/game/TeamStatusGrid'
import LeaderboardTable from '@/components/game/LeaderboardTable'

const STATUS_VARIANT: Record<string, string> = {
  setup: 'bg-secondary',
  active: 'bg-success',
  processing: 'bg-warning text-dark',
  completed: 'bg-primary',
}

export default function QuarterControlPage() {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const { addNotification } = useUIStore()
  const { currentGame, processingReady, setProcessingReady } = useGameStore()

  useSocket(gameId)
  const { teams, leaderboard, refetch } = useGame(gameId ?? '')

  const [decisions, setDecisions] = useState<Decision[]>([])
  const [submittedCount, setSubmittedCount] = useState(0)
  const [activateLoading, setActivateLoading] = useState(false)
  const [lockLoading, setLockLoading] = useState(false)
  const [processLoading, setProcessLoading] = useState(false)
  const [publishLoading, setPublishLoading] = useState(false)
  const [broadcastMsg, setBroadcastMsg] = useState('')
  const [resultsExist, setResultsExist] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const currentQuarter = currentGame?.currentQuarter ?? 0
  const status = currentGame?.status ?? 'setup'
  const maxQuarters = currentGame?.maxQuarters ?? 5
  const winCriteria = currentGame?.winCriteria ?? 'M'
  const noOfTeams = currentGame?.noOfTeams ?? 0

  const fetchDecisions = useCallback(async () => {
    if (!gameId || currentQuarter === 0) return
    try {
      const res = await decisionApi.getAll(gameId, currentQuarter)
      setDecisions(res.data.data.decisions)
      setSubmittedCount(res.data.data.submittedCount)
    } catch (err) {
      // silent — polling shouldn't spam errors
      console.warn('Failed to fetch decisions', err)
    }
  }, [gameId, currentQuarter])

  useEffect(() => {
    fetchDecisions()
    intervalRef.current = setInterval(fetchDecisions, 10000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchDecisions])

  useEffect(() => {
    if (status === 'processing') setProcessingReady(false)
    if (status === 'active' && currentQuarter > 0) {
      // new quarter published — reset processingReady
      setProcessingReady(false)
      setResultsExist(false)
    }
  }, [status, currentQuarter])

  useEffect(() => {
    if (status === 'processing' && gameId && currentQuarter > 0) {
      reportApi.getSectorUpdate(gameId, currentQuarter)
        .then(res => {
          const hasData = (res.data?.data?.teams?.length ?? 0) > 0
          if (hasData) setResultsExist(true)
        })
        .catch(() => {})
    }
  }, [status, currentQuarter, gameId])

  const handleActivateGame = async () => {
    if (!currentGame) return
    if (!window.confirm(
      `Start "${currentGame.name}"?\n\nTeams will be able to submit Q1 decisions.`
    )) return
    setActivateLoading(true)
    try {
      await gameApi.activate(currentGame.gameId)
      addNotification('success', 'Game started! Teams can now submit Q1 decisions.')
      refetch()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start game'
      addNotification('error', msg)
    } finally {
      setActivateLoading(false)
    }
  }

  const handleLock = async () => {
    if (!gameId) return
    if (!window.confirm(`Lock Q${currentQuarter}? Teams cannot submit after this.`)) {
      return
    }
    setLockLoading(true)
    try {
      await gameApi.lock(gameId)
      addNotification('success', `Quarter ${currentQuarter} locked`)
      refetch()
      fetchDecisions()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lock failed'
      addNotification('error', msg)
    } finally {
      setLockLoading(false)
    }
  }

  const handleProcess = async () => {
    if (!gameId) return
    if (
      !window.confirm(
        `Process Q${currentQuarter} with ${submittedCount}/${noOfTeams} teams submitted? This cannot be undone.`
      )
    ) {
      return
    }
    setProcessLoading(true)
    try {
      await gameApi.process(gameId)
      addNotification('info', 'Engine processing started')
      setProcessingReady(true)
      refetch()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Process failed'
      addNotification('error', msg)
    } finally {
      setProcessLoading(false)
    }
  }

  const handlePublish = async () => {
    if (!gameId) return
    if (!window.confirm(`Publish Q${currentQuarter} results? Teams will see their reports.`)) {
      return
    }
    setPublishLoading(true)
    try {
      await gameApi.publish(gameId)
      addNotification('success', `Quarter ${currentQuarter} results published`)
      setProcessingReady(false)
      refetch()
      fetchDecisions()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Publish failed'
      addNotification('error', msg)
    } finally {
      setPublishLoading(false)
    }
  }

  const handleBroadcast = () => {
    if (!gameId || !broadcastMsg.trim()) return
    socketEvents.broadcast(gameId, broadcastMsg.trim())
    addNotification('success', 'Broadcast sent')
    setBroadcastMsg('')
  }

  const anyActionRunning = lockLoading || processLoading || publishLoading
  const isLocked = status === 'processing' || status === 'completed'

  const lockEnabled = status === 'active' && !anyActionRunning
  const processEnabled =
    status === 'processing' && submittedCount >= 1 && !anyActionRunning
  const publishEnabled = (processingReady || resultsExist) && !anyActionRunning

  const processTooltip = submittedCount < 1
    ? 'Waiting for at least 1 team to submit'
    : ''

  const statusCls = STATUS_VARIANT[status] ?? 'bg-secondary'

  const decisionStatuses = decisions.map((d) => ({
    teamNo: d.teamNo,
    submittedAt: d.submittedAt ?? '',
    isLocked: d.isLocked,
  }))

  return (
    <div>
      <div className="bg-white rounded-3 shadow-sm p-3 mb-4">
        <div className="d-flex flex-wrap align-items-center gap-3">
          <h3 className="mb-0">{currentGame?.name ?? 'Loading...'}</h3>
          <span className="badge bg-light text-dark border">
            {currentGame?.gameId}
          </span>
          <QuarterBadge quarterNo={currentQuarter} maxQuarters={maxQuarters} />
          <span className={`badge ${statusCls} text-uppercase`}>{status}</span>
          <div className="ms-auto small text-muted">
            Win: {WIN_CRITERIA_LABELS[winCriteria]}
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-4">
          <div className="bg-white rounded-3 shadow-sm p-3 mb-3">
            <h5 className="mb-3">Quarter Control</h5>
            <div className="mb-2">
              <div className="small text-muted">Current</div>
              <div className="fs-4 fw-bold">
                Quarter {currentQuarter} of {maxQuarters}
              </div>
            </div>
            <div className="mb-3">
              <span className={`badge ${statusCls} text-uppercase`}>
                {status}
              </span>
            </div>

            <div className="d-grid gap-2">
              {status === 'setup' && (
                <div className="mb-1">
                  <div
                    className="alert py-2 mb-2"
                    style={{ background: '#e8f4f8', border: '1px solid #bee5eb' }}
                  >
                    <small>
                      <strong>Game is in Setup mode.</strong><br />
                      Teams cannot submit decisions yet.
                      Click Start Game when you are ready to begin.
                    </small>
                  </div>
                  <Button
                    variant="success"
                    className="w-100 py-2"
                    onClick={handleActivateGame}
                    disabled={activateLoading}
                  >
                    {activateLoading ? (
                      <><Spinner size="sm" animation="border" className="me-2" />Starting...</>
                    ) : (
                      'Start Game — Open Q1 for Teams'
                    )}
                  </Button>
                </div>
              )}

              <Button
                variant="outline-primary"
                disabled={!lockEnabled}
                onClick={handleLock}
              >
                {lockLoading ? (
                  <Spinner size="sm" animation="border" className="me-2" />
                ) : null}
                🔒 Lock Quarter
              </Button>

              <Button
                variant="outline-warning"
                disabled={!processEnabled}
                onClick={handleProcess}
                title={processTooltip}
              >
                {processLoading ? (
                  <Spinner size="sm" animation="border" className="me-2" />
                ) : null}
                ⚙️ Process Quarter
                <div className="small mt-1">
                  <span className={submittedCount > 0 ? 'text-success' : 'text-warning'}>
                    {submittedCount}/{noOfTeams} teams submitted
                    {submittedCount > 0 && submittedCount < noOfTeams
                      ? ' — can process now'
                      : ''}
                  </span>
                </div>
              </Button>

              {resultsExist && !processingReady && (
                <div className="alert alert-success py-2 small mb-2">
                  Engine completed. Results ready — click Publish to release to teams.
                </div>
              )}
              <Button
                variant="outline-success"
                disabled={!publishEnabled}
                onClick={handlePublish}
              >
                {publishLoading ? (
                  <Spinner size="sm" animation="border" className="me-2" />
                ) : null}
                📢 Publish Results
              </Button>

              <Button
                variant="link"
                size="sm"
                onClick={() =>
                  navigate(`/facilitator/game/${gameId}/sector/${currentQuarter}`)
                }
              >
                📊 View Sector Update
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-3 shadow-sm p-3">
            <h5 className="mb-3">Broadcast Message</h5>
            <Form.Control
              as="textarea"
              rows={3}
              value={broadcastMsg}
              onChange={(e) => setBroadcastMsg(e.target.value)}
              placeholder="Type a message to all teams..."
              className="mb-2"
            />
            <Button
              variant="primary"
              size="sm"
              disabled={!broadcastMsg.trim()}
              onClick={handleBroadcast}
            >
              Send to All Teams
            </Button>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="bg-white rounded-3 shadow-sm p-3 h-100">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="mb-0">Team Submissions</h5>
              <span className="small text-muted">
                {submittedCount}/{noOfTeams} submitted
              </span>
            </div>
            <TeamStatusGrid
              teams={teams}
              decisions={decisionStatuses}
              currentQuarter={currentQuarter}
              isLocked={isLocked}
              totalTeams={noOfTeams}
            />
          </div>
        </div>

        <div className="col-lg-4">
          <div className="bg-white rounded-3 shadow-sm p-3 h-100">
            <h5 className="mb-1">Live Leaderboard</h5>
            <div className="small text-muted mb-3">
              Results from last completed quarter
            </div>
            <LeaderboardTable
              entries={leaderboard}
              winCriteria={winCriteria}
              teams={teams}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
