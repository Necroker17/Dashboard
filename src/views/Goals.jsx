import { useState, useRef, useMemo } from 'react'
import { useDashboard } from '../context/DashboardContext'
import Modal from '../components/Modal'
import { format, isPast } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Target, Plus, Pencil, Trash2, Check, ChevronDown, ChevronRight,
  TrendingUp, TrendingDown, MoreHorizontal, Flag,
} from 'lucide-react'
import { krProgress, objectiveProgress } from '../lib/okr'

const STATUS_LABELS = { active: 'Activo', completed: 'Completado', abandoned: 'Abandonado' }
const STATUS_LABELS_PLURAL = { active: 'activos', completed: 'completados', abandoned: 'abandonados' }
const STATUS_COLORS = { active: '#7c3aed', completed: '#22c55e', abandoned: '#6b7280' }
const COLORS = ['#7c3aed', '#a855f7', '#2563eb', '#059669', '#d97706', '#dc2626', '#db2777', '#0891b2']

const fmtNum = (n) => {
  const v = Number(n ?? 0)
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, '')
}

function ProgressBar({ value, color = '#7c3aed', thick = false }) {
  return (
    <div className={`w-full bg-zinc-800 rounded-full overflow-hidden ${thick ? 'h-2' : 'h-1.5'}`}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${value}%`, background: `linear-gradient(90deg, ${color}, ${color}aa)` }}
      />
    </div>
  )
}

/* ─────────────────────────  Resultado clave  ───────────────────────── */

function KeyResultRow({ kr, onUpdate, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(kr.current_value ?? 0)
  const committed = useRef(false)
  const pct = krProgress(kr)

  const startEditing = () => {
    committed.current = false
    setValue(kr.current_value ?? 0)
    setEditing(true)
  }

  // onBlur y Enter apuntan aquí: sin el guard, pulsar Enter desmonta el input,
  // eso dispara el blur, y se guardaba dos veces.
  const commit = async () => {
    if (committed.current) return
    committed.current = true
    setEditing(false)
    const next = Number(value)
    if (!Number.isNaN(next) && next !== Number(kr.current_value)) {
      await onUpdate(kr.id, { current_value: next })
    }
  }

  return (
    <div className="group flex items-center gap-3 py-2.5 pl-4 pr-2 border-l-2 border-zinc-800 hover:border-zinc-700 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {kr.direction === 'decrease'
            ? <TrendingDown size={12} className="text-zinc-500 flex-shrink-0" />
            : <TrendingUp size={12} className="text-zinc-500 flex-shrink-0" />}
          <span className="text-sm text-zinc-200 truncate">{kr.title}</span>
        </div>
        <div className="mt-1.5 flex items-center gap-3">
          <div className="flex-1"><ProgressBar value={pct} color={pct >= 100 ? '#22c55e' : '#7c3aed'} /></div>
          <span className="text-xs text-zinc-500 tabular-nums flex-shrink-0 w-10 text-right">{pct}%</span>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {editing ? (
          <input
            type="number"
            step="any"
            autoFocus
            value={value}
            onChange={e => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { committed.current = true; setEditing(false) } }}
            className="w-20 bg-zinc-800 border border-violet-500 rounded-lg px-2 py-1 text-sm text-zinc-100 text-right outline-none"
          />
        ) : (
          <button
            onClick={startEditing}
            className="text-sm tabular-nums text-zinc-400 hover:text-violet-300 transition-colors px-2 py-1 rounded-lg hover:bg-zinc-800"
            title="Actualizar avance"
          >
            <span className="text-zinc-200 font-medium">{fmtNum(kr.current_value)}</span>
            <span className="text-zinc-600"> / {fmtNum(kr.target_value)}</span>
            {kr.unit && <span className="text-zinc-600 ml-1">{kr.unit}</span>}
          </button>
        )}

        <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(kr)} className="text-zinc-600 hover:text-zinc-300 p-1 rounded"><Pencil size={12} /></button>
          <button onClick={() => onDelete(kr.id)} className="text-zinc-600 hover:text-red-400 p-1 rounded"><Trash2 size={12} /></button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────  Objetivo  ───────────────────────── */

function ObjectiveCard({ objective, keyResults, onUpdateKr, onEditKr, onDeleteKr, onAddKr, onEdit, onDelete }) {
  const [open, setOpen] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const pct = objectiveProgress(keyResults)
  const color = objective.color || '#7c3aed'
  const overdue = objective.deadline && isPast(new Date(objective.deadline + 'T23:59:59')) && objective.status === 'active'

  return (
    <div className="card overflow-hidden">
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${color}, ${color}40)` }} />

      <div className="p-4">
        <div className="flex items-start gap-3">
          <button onClick={() => setOpen(o => !o)} className="mt-0.5 text-zinc-600 hover:text-zinc-400 flex-shrink-0">
            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-zinc-100">{objective.title}</h3>
              {objective.period && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400">{objective.period}</span>
              )}
              {objective.status !== 'active' && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: STATUS_COLORS[objective.status] + '25', color: STATUS_COLORS[objective.status] }}
                >
                  {STATUS_LABELS[objective.status]}
                </span>
              )}
            </div>

            {objective.description && (
              <p className="text-sm text-zinc-500 mt-1 leading-relaxed">{objective.description}</p>
            )}

            <div className="flex items-center gap-3 mt-3">
              <div className="flex-1"><ProgressBar value={pct} color={color} thick /></div>
              <span className="text-sm font-semibold tabular-nums flex-shrink-0" style={{ color }}>{pct}%</span>
            </div>

            <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
              <span>{keyResults.length} {keyResults.length === 1 ? 'resultado clave' : 'resultados clave'}</span>
              {objective.deadline && (
                <span className={overdue ? 'text-red-400' : ''}>
                  <Flag size={10} className="inline mr-1" />
                  {format(new Date(objective.deadline + 'T00:00:00'), "d 'de' MMMM", { locale: es })}
                  {overdue && ' (vencido)'}
                </span>
              )}
            </div>
          </div>

          <div className="relative flex-shrink-0">
            <button onClick={() => setMenuOpen(o => !o)} className="text-zinc-600 hover:text-zinc-300 p-1 rounded">
              <MoreHorizontal size={16} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-8 z-20 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl py-1 w-40">
                  <button onClick={() => { onEdit(objective); setMenuOpen(false) }} className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 flex items-center gap-2">
                    <Pencil size={13} /> Editar objetivo
                  </button>
                  <button onClick={() => { onDelete(objective); setMenuOpen(false) }} className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-zinc-700 flex items-center gap-2">
                    <Trash2 size={13} /> Eliminar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {open && (
          <div className="mt-3 ml-7">
            {keyResults.length === 0 ? (
              <p className="text-xs text-zinc-600 py-3 pl-4 border-l-2 border-zinc-800">
                Sin resultados clave todavía. Un objetivo se mide con 2 a 5.
              </p>
            ) : (
              keyResults.map(kr => (
                <KeyResultRow
                  key={kr.id}
                  kr={kr}
                  onUpdate={onUpdateKr}
                  onEdit={onEditKr}
                  onDelete={onDeleteKr}
                />
              ))
            )}
            <button
              onClick={() => onAddKr(objective.id)}
              className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors mt-2 ml-4"
            >
              <Plus size={12} /> Añadir resultado clave
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────  Formularios  ───────────────────────── */

function ObjectiveForm({ objective, projects, onSave, onClose }) {
  const [form, setForm] = useState({
    title: objective?.title || '',
    description: objective?.description || '',
    period: objective?.period || '',
    deadline: objective?.deadline || '',
    project_id: objective?.project_id || '',
    color: objective?.color || '#7c3aed',
    status: objective?.status || 'active',
  })
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = () => {
    if (!form.title.trim()) { setError('El objetivo necesita un título.'); return }
    setError('')
    onSave(form)
  }

  return (
    <div className="space-y-4">
      <div className="h-1.5 rounded-full -mt-1 mb-5" style={{ background: `linear-gradient(90deg, ${form.color}, ${form.color}80)` }} />

      <div>
        <label className="label">Objetivo *</label>
        <input className="input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Lanzar la marca en Colombia" autoFocus />
        <p className="text-xs text-zinc-600 mt-1.5">Cualitativo y ambicioso. Lo medible va en los resultados clave.</p>
      </div>

      <div>
        <label className="label">Descripción</label>
        <textarea className="input resize-none" rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="¿Por qué importa este objetivo?" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Periodo</label>
          <input className="input" value={form.period} onChange={e => set('period', e.target.value)} placeholder="2026-Q4" />
        </div>
        <div>
          <label className="label">Fecha límite</label>
          <input type="date" className="input" value={form.deadline} onChange={e => set('deadline', e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Proyecto</label>
          <select className="input" value={form.project_id} onChange={e => set('project_id', e.target.value)}>
            <option value="">Sin proyecto</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Estado</label>
          <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Color</label>
        <div className="flex gap-2.5 mt-1.5">
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => set('color', c)}
              className={`w-8 h-8 rounded-full transition-all ${form.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900 scale-110' : 'hover:scale-105'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {error && <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</div>}

      <div className="flex gap-2 pt-2">
        <button
          onClick={save}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
          style={{ background: `linear-gradient(135deg, ${form.color}, ${form.color}cc)` }}
        >
          <Check size={15} /> {objective ? 'Actualizar' : 'Crear objetivo'}
        </button>
        <button onClick={onClose} className="btn-ghost">Cancelar</button>
      </div>
    </div>
  )
}

function KeyResultForm({ kr, objectives, defaultObjectiveId, onSave, onClose }) {
  const [form, setForm] = useState({
    title: kr?.title || '',
    objective_id: kr?.objective_id || defaultObjectiveId || '',
    direction: kr?.direction || 'increase',
    start_value: kr?.start_value ?? 0,
    current_value: kr?.current_value ?? 0,
    target_value: kr?.target_value ?? '',
    unit: kr?.unit || '',
    deadline: kr?.deadline || '',
  })
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = () => {
    if (!form.title.trim()) { setError('El resultado clave necesita un título.'); return }
    if (form.target_value === '' || Number.isNaN(Number(form.target_value))) {
      setError('Un resultado clave tiene que ser medible: indica el valor objetivo.')
      return
    }
    setError('')
    onSave({
      ...form,
      start_value: Number(form.start_value || 0),
      current_value: Number(form.current_value || 0),
      target_value: Number(form.target_value),
    })
  }

  const preview = krProgress({
    direction: form.direction,
    start_value: Number(form.start_value || 0),
    current_value: Number(form.current_value || 0),
    target_value: Number(form.target_value || 0),
  })

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Resultado clave *</label>
        <input className="input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Cerrar 30 pedidos COD" autoFocus />
      </div>

      <div>
        <label className="label">Objetivo</label>
        <select className="input" value={form.objective_id} onChange={e => set('objective_id', e.target.value)}>
          <option value="">Sin objetivo (meta suelta)</option>
          {objectives.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}
        </select>
      </div>

      <div>
        <label className="label">Dirección</label>
        <div className="grid grid-cols-2 gap-2">
          {[
            ['increase', 'Subir', TrendingUp, 'De 0 a 30 pedidos'],
            ['decrease', 'Bajar', TrendingDown, 'De $12 a $8 de CPA'],
          ].map(([val, label, Icon, hint]) => (
            <button
              key={val}
              onClick={() => set('direction', val)}
              className={`flex flex-col items-start gap-0.5 px-3 py-2 rounded-xl border text-left transition-all ${
                form.direction === val
                  ? 'bg-violet-600/15 border-violet-500/40 text-violet-200'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span className="flex items-center gap-1.5 text-sm font-medium"><Icon size={13} /> {label}</span>
              <span className="text-xs opacity-60">{hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Punto de partida</label>
          <input type="number" step="any" className="input" value={form.start_value} onChange={e => set('start_value', e.target.value)} />
        </div>
        <div>
          <label className="label">Valor actual</label>
          <input type="number" step="any" className="input" value={form.current_value} onChange={e => set('current_value', e.target.value)} />
        </div>
        <div>
          <label className="label">Objetivo *</label>
          <input type="number" step="any" className="input" value={form.target_value} onChange={e => set('target_value', e.target.value)} placeholder="30" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Unidad</label>
          <input className="input" value={form.unit} onChange={e => set('unit', e.target.value)} placeholder="pedidos, %, USD" />
        </div>
        <div>
          <label className="label">Fecha límite</label>
          <input type="date" className="input" value={form.deadline} onChange={e => set('deadline', e.target.value)} />
        </div>
      </div>

      {form.target_value !== '' && (
        <div className="bg-zinc-800/60 border border-zinc-700 rounded-xl px-3 py-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-zinc-500">Progreso con estos valores</span>
            <span className="text-xs font-semibold text-violet-300 tabular-nums">{preview}%</span>
          </div>
          <ProgressBar value={preview} />
        </div>
      )}

      {error && <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</div>}

      <div className="flex gap-2 pt-2">
        <button onClick={save} className="btn-primary flex-1 justify-center">
          <Check size={15} /> {kr ? 'Actualizar' : 'Añadir resultado clave'}
        </button>
        <button onClick={onClose} className="btn-ghost">Cancelar</button>
      </div>
    </div>
  )
}

/* ─────────────────────────  Vista  ───────────────────────── */

export default function Goals() {
  const {
    goals, objectives, projects,
    createObjective, updateObjective, deleteObjective,
    createGoal, updateGoal, deleteGoal,
  } = useDashboard()

  const [filter, setFilter] = useState('active')
  const [objModal, setObjModal] = useState(null)   // null | 'new' | objective
  const [krModal, setKrModal] = useState(null)     // null | {objectiveId} | kr
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [error, setError] = useState('')

  const visible = useMemo(
    () => objectives.filter(o => filter === 'all' || o.status === filter),
    [objectives, filter]
  )
  const krsOf = (objectiveId) => goals.filter(g => g.objective_id === objectiveId)
  const loose = goals.filter(g => !g.objective_id)

  const activeObjectives = objectives.filter(o => o.status === 'active')
  const avgProgress = activeObjectives.length
    ? Math.round(activeObjectives.reduce((s, o) => s + objectiveProgress(krsOf(o.id)), 0) / activeObjectives.length)
    : 0

  const run = async (fn) => {
    setError('')
    try { await fn() } catch (err) { setError(err.message) }
  }

  const saveObjective = (form) => run(async () => {
    if (objModal === 'new') await createObjective(form)
    else await updateObjective(objModal.id, form)
    setObjModal(null)
  })

  const saveKr = (form) => run(async () => {
    if (krModal?.id) await updateGoal(krModal.id, form)
    else await createGoal(form)
    setKrModal(null)
  })

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <Target size={20} className="text-zinc-400" /> Objetivos y resultados clave
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {activeObjectives.length} {activeObjectives.length === 1 ? 'objetivo activo' : 'objetivos activos'} · {avgProgress}% de avance promedio
          </p>
        </div>
        <button
          onClick={() => setObjModal('new')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
        >
          <Plus size={15} /> Nuevo objetivo
        </button>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</div>
      )}

      <div className="flex gap-1.5 mb-5">
        {[['active', 'Activos'], ['completed', 'Completados'], ['abandoned', 'Abandonados'], ['all', 'Todos']].map(([v, l]) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filter === v ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {visible.length === 0 && loose.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <Target size={40} className="mx-auto mb-3 opacity-20" />
          <p>Sin objetivos {filter !== 'all' ? STATUS_LABELS_PLURAL[filter] : ''}</p>
          <button onClick={() => setObjModal('new')} className="btn-primary mt-4 text-sm">
            <Plus size={14} /> Crear el primero
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map(o => (
            <ObjectiveCard
              key={o.id}
              objective={o}
              keyResults={krsOf(o.id)}
              onUpdateKr={(id, data) => run(() => updateGoal(id, data))}
              onEditKr={kr => setKrModal(kr)}
              onDeleteKr={id => run(() => deleteGoal(id))}
              onAddKr={objectiveId => setKrModal({ objectiveId })}
              onEdit={obj => setObjModal(obj)}
              onDelete={obj => setConfirmDelete(obj)}
            />
          ))}

          {loose.length > 0 && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-zinc-300 text-sm">Metas sueltas</h3>
                <span className="text-xs text-zinc-600">sin objetivo asociado</span>
              </div>
              {loose.map(kr => (
                <KeyResultRow
                  key={kr.id}
                  kr={kr}
                  onUpdate={(id, data) => run(() => updateGoal(id, data))}
                  onEdit={k => setKrModal(k)}
                  onDelete={id => run(() => deleteGoal(id))}
                />
              ))}
            </div>
          )}

          <button
            onClick={() => setKrModal({ objectiveId: '' })}
            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <Plus size={14} /> Añadir una meta suelta
          </button>
        </div>
      )}

      {objModal !== null && (
        <Modal title={objModal === 'new' ? 'Nuevo objetivo' : 'Editar objetivo'} onClose={() => setObjModal(null)}>
          <ObjectiveForm
            objective={objModal === 'new' ? null : objModal}
            projects={projects}
            onSave={saveObjective}
            onClose={() => setObjModal(null)}
          />
        </Modal>
      )}

      {krModal !== null && (
        <Modal title={krModal?.id ? 'Editar resultado clave' : 'Nuevo resultado clave'} onClose={() => setKrModal(null)}>
          <KeyResultForm
            kr={krModal?.id ? krModal : null}
            objectives={objectives}
            defaultObjectiveId={krModal?.objectiveId}
            onSave={saveKr}
            onClose={() => setKrModal(null)}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Eliminar objetivo" onClose={() => setConfirmDelete(null)}>
          <div className="space-y-4">
            <p className="text-sm text-zinc-300">
              ¿Seguro que quieres eliminar <strong className="text-zinc-100">{confirmDelete.title}</strong>?
            </p>
            <p className="text-sm text-zinc-500">
              Sus {krsOf(confirmDelete.id).length} resultados clave no se borran: quedan como metas sueltas
              y los puedes reasignar.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => run(async () => { await deleteObjective(confirmDelete.id); setConfirmDelete(null) })}
                className="btn-danger flex-1 justify-center"
              >
                <Trash2 size={15} /> Eliminar objetivo
              </button>
              <button onClick={() => setConfirmDelete(null)} className="btn-ghost">Cancelar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
