import { useState } from 'react'
import { useDashboard } from '../context/DashboardContext'
import Modal from '../components/Modal'
import { Target, Plus, Check, Pencil, Trash2, TrendingUp, Trophy } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const STATUS_COLORS = { active: 'text-violet-400 bg-violet-400/10', completed: 'text-green-400 bg-green-400/10', abandoned: 'text-zinc-500 bg-zinc-800' }
const STATUS_LABELS = { active: 'Activa', completed: 'Completada', abandoned: 'Abandonada' }

function GoalForm({ goal, projects, onSave, onClose }) {
  const [form, setForm] = useState({
    title: goal?.title || '',
    description: goal?.description || '',
    target_value: goal?.target_value || '',
    current_value: goal?.current_value || 0,
    unit: goal?.unit || '',
    deadline: goal?.deadline || '',
    status: goal?.status || 'active',
    project_id: goal?.project_id || '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const save = () => { if (form.title.trim()) onSave(form) }
  return (
    <div className="space-y-4">
      <div><label className="label">Título *</label><input className="input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="¿Qué quieres lograr?" /></div>
      <div><label className="label">Descripción</label><textarea className="input resize-none" rows={2} value={form.description} onChange={e => set('description', e.target.value)} /></div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className="label">Valor actual</label><input type="number" className="input" value={form.current_value} onChange={e => set('current_value', e.target.value)} /></div>
        <div><label className="label">Meta</label><input type="number" className="input" value={form.target_value} onChange={e => set('target_value', e.target.value)} /></div>
        <div><label className="label">Unidad</label><input className="input" value={form.unit} onChange={e => set('unit', e.target.value)} placeholder="km, $, hs..." /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Fecha límite</label><input type="date" className="input" value={form.deadline} onChange={e => set('deadline', e.target.value)} /></div>
        <div>
          <label className="label">Estado</label>
          <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="active">Activa</option>
            <option value="completed">Completada</option>
            <option value="abandoned">Abandonada</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label">Proyecto</label>
        <select className="input" value={form.project_id} onChange={e => set('project_id', e.target.value)}>
          <option value="">Sin proyecto</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="flex gap-2 pt-2">
        <button onClick={save} className="btn-primary flex-1 justify-center"><Check size={15} />{goal ? 'Actualizar' : 'Crear meta'}</button>
        <button onClick={onClose} className="btn-ghost">Cancelar</button>
      </div>
    </div>
  )
}

function GoalCard({ goal, project, onEdit, onUpdate, onDelete }) {
  const pct = goal.target_value ? Math.min(100, Math.round((goal.current_value / goal.target_value) * 100)) : 0
  const [updating, setUpdating] = useState(false)
  const [newValue, setNewValue] = useState(goal.current_value)

  const handleUpdate = async () => {
    setUpdating(false)
    await onUpdate(goal.id, { current_value: Number(newValue), status: Number(newValue) >= Number(goal.target_value) ? 'completed' : goal.status })
  }

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-semibold text-zinc-100">{goal.title}</h3>
          {goal.description && <p className="text-sm text-zinc-400 mt-0.5">{goal.description}</p>}
        </div>
        <div className="flex items-center gap-1">
          <span className={`badge text-xs ${STATUS_COLORS[goal.status]}`}>{STATUS_LABELS[goal.status]}</span>
          <button onClick={() => onEdit(goal)} className="text-zinc-600 hover:text-zinc-300 p-1 rounded"><Pencil size={13} /></button>
          <button onClick={() => onDelete(goal.id)} className="text-zinc-600 hover:text-red-400 p-1 rounded"><Trash2 size={13} /></button>
        </div>
      </div>

      {goal.target_value && (
        <>
          <div className="flex items-end justify-between mb-2">
            <div className="flex items-baseline gap-1">
              {updating ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={newValue}
                    onChange={e => setNewValue(e.target.value)}
                    className="input w-24 py-1 text-sm"
                    onBlur={handleUpdate}
                    onKeyDown={e => e.key === 'Enter' && handleUpdate()}
                    autoFocus
                  />
                  <span className="text-sm text-zinc-500">/ {goal.target_value} {goal.unit}</span>
                </div>
              ) : (
                <button onClick={() => setUpdating(true)} className="flex items-baseline gap-1 hover:text-violet-300 transition-colors">
                  <span className="text-2xl font-bold text-zinc-100">{goal.current_value}</span>
                  <span className="text-sm text-zinc-500">/ {goal.target_value} {goal.unit}</span>
                </button>
              )}
            </div>
            <span className={`text-lg font-bold ${pct >= 100 ? 'text-green-400' : 'text-violet-400'}`}>{pct}%</span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-green-500' : 'bg-gradient-to-r from-violet-600 to-violet-400'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </>
      )}

      <div className="flex items-center justify-between mt-3 text-xs text-zinc-500">
        {project && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: project.color || '#7c3aed' }} />{project.name}</span>}
        {goal.deadline && <span>Fecha: {format(new Date(goal.deadline + 'T00:00:00'), 'd MMM yyyy', { locale: es })}</span>}
      </div>
    </div>
  )
}

export default function Goals() {
  const { goals, projects, createGoal, updateGoal, deleteGoal } = useDashboard()
  const [modal, setModal] = useState(null)
  const [filter, setFilter] = useState('all')

  const filtered = goals.filter(g => filter === 'all' || g.status === filter)
  const active = goals.filter(g => g.status === 'active')
  const completed = goals.filter(g => g.status === 'completed')
  const avgProgress = active.length ? Math.round(active.reduce((s, g) => s + (g.target_value ? (g.current_value / g.target_value) * 100 : 0), 0) / active.length) : 0

  const handleSave = async (form) => {
    if (modal === 'new') await createGoal(form)
    else await updateGoal(modal.id, form)
    setModal(null)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2"><Target size={20} className="text-zinc-400" /> Metas</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{active.length} activas · {completed.length} completadas · {avgProgress}% progreso promedio</p>
        </div>
        <button onClick={() => setModal('new')} className="btn-primary"><Plus size={15} /> Nueva meta</button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-violet-400">{active.length}</div>
          <div className="text-xs text-zinc-500 mt-1">Activas</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-green-400">{completed.length}</div>
          <div className="text-xs text-zinc-500 mt-1">Completadas</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-zinc-100">{avgProgress}%</div>
          <div className="text-xs text-zinc-500 mt-1">Progreso promedio</div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {[['all', 'Todas'], ['active', 'Activas'], ['completed', 'Completadas'], ['abandoned', 'Abandonadas']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${filter === v ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}`}>{l}</button>
        ))}
      </div>

      {/* Goals grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <Trophy size={40} className="mx-auto mb-3 opacity-20" />
          <p>Sin metas {filter !== 'all' ? STATUS_LABELS[filter]?.toLowerCase() + 's' : ''}</p>
          <button onClick={() => setModal('new')} className="btn-primary mt-3 text-sm"><Plus size={14} /> Crear meta</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(g => (
            <GoalCard
              key={g.id}
              goal={g}
              project={projects.find(p => p.id === g.project_id)}
              onEdit={g => setModal(g)}
              onUpdate={updateGoal}
              onDelete={deleteGoal}
            />
          ))}
        </div>
      )}

      {modal !== null && (
        <Modal title={modal === 'new' ? 'Nueva meta' : 'Editar meta'} onClose={() => setModal(null)}>
          <GoalForm goal={modal === 'new' ? null : modal} projects={projects} onSave={handleSave} onClose={() => setModal(null)} />
        </Modal>
      )}
    </div>
  )
}
