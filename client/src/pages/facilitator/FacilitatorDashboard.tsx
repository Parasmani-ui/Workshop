import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal, Button, Form } from 'react-bootstrap'
import { gameApi, scenarioApi } from '@/services/api'
import { useUIStore } from '@/store/uiStore'
import type { Game, Scenario, WinCriteria } from '@/types/game.types'
import { WIN_CRITERIA_LABELS } from '@/types/game.types'
import StatCard from '@/components/common/StatCard'
import QuarterBadge from '@/components/common/QuarterBadge'

const STATUS_VARIANT: Record<string, string> = {
  setup: 'bg-secondary',
  active: 'bg-success',
  processing: 'bg-warning text-dark',
  completed: 'bg-primary',
}

interface CreateForm {
  gameId: string
  name: string
  scenarioId: string
  noOfTeams: number
  maxQuarters: number
  winCriteria: WinCriteria
}

const EMPTY_FORM: CreateForm = {
  gameId: '',
  name: '',
  scenarioId: '',
  noOfTeams: 4,
  maxQuarters: 5,
  winCriteria: 'M',
}

export default function FacilitatorDashboard() {
  const navigate = useNavigate()
  const { addNotification } = useUIStore()

  const [games, setGames] = useState<Game[]>([])
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [deletingGameId, setDeletingGameId] = useState<string | null>(null)

  const fetchGames = useCallback(async () => {
    setLoading(true)
    try {
      const res = await gameApi.list()
      setGames(res.data.data.games)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load games'
      addNotification('error', msg)
    } finally {
      setLoading(false)
    }
  }, [addNotification])

  const fetchScenarios = useCallback(async () => {
    try {
      const res = await scenarioApi.list()
      setScenarios(res.data.data.scenarios)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load scenarios'
      addNotification('error', msg)
    }
  }, [addNotification])

  useEffect(() => {
    fetchGames()
    fetchScenarios()
  }, [fetchGames, fetchScenarios])

  const openModal = () => {
    setForm({
      ...EMPTY_FORM,
      scenarioId: scenarios[0]?._id ?? '',
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.gameId || !form.name || !form.scenarioId) {
      addNotification('error', 'Please fill all required fields')
      return
    }
    setSubmitting(true)
    try {
      await gameApi.create({
        gameId: form.gameId,
        name: form.name,
        scenarioId: form.scenarioId,
        winCriteria: form.winCriteria,
        noOfTeams: form.noOfTeams,
        maxQuarters: form.maxQuarters,
      })
      addNotification('success', `Game "${form.name}" created`)
      closeModal()
      fetchGames()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create game'
      addNotification('error', msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteGame = async (gId: string, gameName: string) => {
    const confirmed = window.confirm(
      `Delete "${gameName}"?\n\n` +
      `This will permanently delete:\n` +
      `- All team data\n` +
      `- All decisions\n` +
      `- All quarter results\n` +
      `- All reports\n\n` +
      `This cannot be undone.`
    )
    if (!confirmed) return

    setDeletingGameId(gId)
    try {
      await gameApi.remove(gId)
      addNotification('success', `Game "${gId}" deleted.`)
      fetchGames()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete game'
      addNotification('error', msg)
    } finally {
      setDeletingGameId(null)
    }
  }

  const activeGamesCount = games.filter(
    (g) => g.status === 'active' || g.status === 'processing'
  ).length

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-0">Dashboard</h2>
          <div className="text-muted small">Manage your simulation games</div>
        </div>
        <Button variant="primary" onClick={openModal}>
          + New Game
        </Button>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <StatCard
            title="Active Games"
            value={activeGamesCount}
            variant="success"
            icon="🟢"
          />
        </div>
        <div className="col-md-4">
          <StatCard
            title="Total Games"
            value={games.length}
            variant="primary"
            icon="📊"
          />
        </div>
        <div className="col-md-4">
          <StatCard
            title="Scenarios Available"
            value={scenarios.length}
            variant="warning"
            icon="📦"
          />
        </div>
      </div>

      <h4 className="mb-3">Games</h4>

      {loading && <div className="text-muted">Loading games...</div>}

      {!loading && games.length === 0 && (
        <div className="bg-white rounded-3 shadow-sm p-5 text-center">
          <div className="fs-4 mb-2">No games yet</div>
          <div className="text-muted mb-3">
            Create your first game to get started
          </div>
          <Button variant="primary" onClick={openModal}>
            Create your first game
          </Button>
        </div>
      )}

      {!loading && games.length > 0 && (
        <div className="row g-3">
          {games.map((game) => {
            const statusCls = STATUS_VARIANT[game.status] ?? 'bg-secondary'
            return (
              <div key={game._id} className="col-md-6 col-lg-4">
                <div className="bg-white rounded-3 shadow-sm p-3 h-100 d-flex flex-column">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div>
                      <div className="fw-bold fs-5">{game.name}</div>
                      <span className="badge bg-light text-dark border">
                        {game.gameId}
                      </span>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <span className={`badge ${statusCls} text-uppercase`}>
                        {game.status}
                      </span>
                      <button
                        className="btn btn-outline-danger btn-sm px-1 py-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteGame(game.gameId, game.name)
                        }}
                        disabled={deletingGameId === game.gameId}
                        title="Delete game"
                      >
                        {deletingGameId === game.gameId
                          ? <span className="spinner-border spinner-border-sm" />
                          : <small>&#x1F5D1;</small>
                        }
                      </button>
                    </div>
                  </div>

                  <div className="mb-2">
                    <QuarterBadge
                      quarterNo={game.currentQuarter}
                      maxQuarters={game.maxQuarters}
                      size="sm"
                    />
                  </div>

                  <div className="small text-muted mb-1">
                    Win: {WIN_CRITERIA_LABELS[game.winCriteria]}
                  </div>
                  <div className="small text-muted mb-3">
                    {game.noOfTeams} teams
                  </div>

                  <Button
                    variant="outline-primary"
                    size="sm"
                    className="mt-auto"
                    onClick={() => navigate(`/facilitator/game/${game.gameId}`)}
                  >
                    Open
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal show={showModal} onHide={closeModal} centered>
        <Form onSubmit={handleCreate}>
          <Modal.Header closeButton>
            <Modal.Title>New Game</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Game ID</Form.Label>
              <Form.Control
                type="text"
                placeholder="MPX-DEMO"
                value={form.gameId}
                onChange={(e) => setForm({ ...form, gameId: e.target.value })}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Game Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="MPX Demo Game"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Scenario</Form.Label>
              <Form.Select
                value={form.scenarioId}
                onChange={(e) => setForm({ ...form, scenarioId: e.target.value })}
                required
              >
                <option value="">— Select scenario —</option>
                {scenarios.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <div className="row">
              <div className="col-6">
                <Form.Group className="mb-3">
                  <Form.Label>Number of Teams</Form.Label>
                  <Form.Control
                    type="number"
                    min={2}
                    max={20}
                    value={form.noOfTeams}
                    onChange={(e) =>
                      setForm({ ...form, noOfTeams: Number(e.target.value) })
                    }
                    required
                  />
                </Form.Group>
              </div>
              <div className="col-6">
                <Form.Group className="mb-3">
                  <Form.Label>Max Quarters</Form.Label>
                  <Form.Control
                    type="number"
                    min={3}
                    max={12}
                    value={form.maxQuarters}
                    onChange={(e) =>
                      setForm({ ...form, maxQuarters: Number(e.target.value) })
                    }
                    required
                  />
                </Form.Group>
              </div>
            </div>

            <Form.Group className="mb-3">
              <Form.Label>Win Criteria</Form.Label>
              <Form.Select
                value={form.winCriteria}
                onChange={(e) =>
                  setForm({ ...form, winCriteria: e.target.value as WinCriteria })
                }
                required
              >
                {(Object.keys(WIN_CRITERIA_LABELS) as WinCriteria[]).map((k) => (
                  <option key={k} value={k}>
                    {WIN_CRITERIA_LABELS[k]}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={closeModal} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Game'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  )
}
