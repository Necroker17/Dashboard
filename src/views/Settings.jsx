import { useState } from 'react'
import { useDashboard } from '../context/DashboardContext'
import { supabase } from '../lib/supabase'
import { Settings as SettingsIcon, User, Bell, Palette, Shield, Save, Loader2, Flame, Plus, Trash2, Check } from 'lucide-react'
import Modal from '../components/Modal'

function HabitForm({ habit, onSave, onClose }) {
  const [form, setForm] = useState({
    name: habit?.name || '',
    description: habit?.description || '',
    icon: habit?.icon || '⚡',
    color: habit?.color || '#6366f1',
    frequency: habit?.frequency || 'daily',
    target_days: habit?.target_days || 1,
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const COLORS = ['#6366f1', '#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626', '#ec4899']
  const ICONS = ['⚡', '💪', '📚', '🏃', '🧘', '💧', '🎯', '✍️', '🌱', '🧠', '😴', '🎨']
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Nombre *</label>
          <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Meditar, Leer..." />
        </div>
        <div>
          <label className="label">Frecuencia</label>
          <select className="input" value={form.frequency} onChange={e => set('frequency', e.target.value)}>
            <option value="daily">Diaria</option>
            <option value="weekly">Semanal</option>
            <option value="custom">Personalizada</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label">Icono</label>
        <div className="flex flex-wrap gap-2 mt-1">
          {ICONS.map(icon => (
            <button key={icon} onClick={() => set('icon', icon)} className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all ${form.icon === icon ? 'bg-violet-600 ring-2 ring-violet-400' : 'bg-zinc-800 hover:bg-zinc-700'}`}>{icon}</button>
          ))}
        </div>
      </div>
      <div>
        <label className="label">Color</label>
        <div className="flex gap-2 mt-1">
          {COLORS.map(c => (
            <button key={c} onClick={() => set('color', c)} className={`w-7 h-7 rounded-full ${form.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900' : ''}`} style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <button onClick={() => { if (form.name.trim()) onSave(form) }} className="btn-primary flex-1 justify-center"><Check size={15} />{habit ? 'Actualizar' : 'Crear hábito'}</button>
        <button onClick={onClose} className="btn-ghost">Cancelar</button>
      </div>
    </div>
  )
}

export default function Settings() {
  const { profile, habits, updateProfile, createHabit, deleteHabit, user } = useDashboard()
  const [form, setForm] = useState({ name: profile?.name || '', tagline: profile?.tagline || '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [habitModal, setHabitModal] = useState(null)
  const [section, setSection] = useState('profile')

  const saveProfile = async () => {
    setSaving(true)
    try {
      await updateProfile(form)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const changePassword = async () => {
    await supabase.auth.updateUser({ password: prompt('Nueva contraseña (min 6 chars):') || '' })
  }

  const handleSaveHabit = async (data) => {
    await createHabit(data)
    setHabitModal(null)
  }

  const sections = [
    { id: 'profile', label: 'Perfil', icon: User },
    { id: 'habits', label: 'Hábitos', icon: Flame },
    { id: 'security', label: 'Seguridad', icon: Shield },
  ]

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2 mb-6"><SettingsIcon size={20} className="text-zinc-400" /> Configuración</h1>

      <div className="grid grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="col-span-1">
          <nav className="space-y-1">
            {sections.map(s => {
              const Icon = s.icon
              return (
                <button key={s.id} onClick={() => setSection(s.id)} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${section === s.id ? 'bg-violet-600/20 text-violet-300' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}>
                  <Icon size={15} /> {s.label}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="col-span-3">
          {section === 'profile' && (
            <div className="card p-5 space-y-4">
              <h2 className="font-semibold text-zinc-200">Información personal</h2>
              <div>
                <label className="label">Email</label>
                <input className="input opacity-60" value={user?.email || ''} disabled />
              </div>
              <div>
                <label className="label">Nombre</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Tu nombre" />
              </div>
              <div>
                <label className="label">Tagline</label>
                <input className="input" value={form.tagline} onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))} placeholder="Builder · Creator · Developer" />
              </div>
              <div>
                <label className="label">Plan</label>
                <div className="flex items-center gap-2">
                  <span className={`badge ${profile?.plan === 'premium' ? 'bg-violet-600/20 text-violet-300' : 'bg-zinc-800 text-zinc-400'}`}>
                    {profile?.plan === 'premium' ? '⭐ Premium' : 'Free'}
                  </span>
                </div>
              </div>
              <button onClick={saveProfile} disabled={saving} className="btn-primary">
                {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <Check size={15} /> : <Save size={15} />}
                {saved ? 'Guardado' : 'Guardar cambios'}
              </button>
            </div>
          )}

          {section === 'habits' && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-zinc-200">Mis hábitos</h2>
                <button onClick={() => setHabitModal('new')} className="btn-primary text-xs"><Plus size={13} /> Nuevo hábito</button>
              </div>
              {habits.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">
                  <Flame size={32} className="mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Sin hábitos aún</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {habits.map(h => (
                    <div key={h.id} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/40">
                      <span className="text-xl">{h.icon || '⚡'}</span>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-zinc-200">{h.name}</div>
                        <div className="text-xs text-zinc-500">{h.frequency} · streak: {h.streak || 0} días</div>
                      </div>
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: h.color || '#6366f1' }} />
                      <button onClick={() => deleteHabit(h.id)} className="text-zinc-600 hover:text-red-400 p-1 rounded transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {section === 'security' && (
            <div className="card p-5 space-y-4">
              <h2 className="font-semibold text-zinc-200">Seguridad</h2>
              <div>
                <label className="label">Email</label>
                <input className="input opacity-60" value={user?.email || ''} disabled />
              </div>
              <div className="pt-2 border-t border-zinc-800">
                <p className="text-sm text-zinc-400 mb-3">Zona de peligro</p>
                <button onClick={() => supabase.auth.signOut()} className="btn-danger">Cerrar sesión</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {habitModal !== null && (
        <Modal title="Nuevo hábito" onClose={() => setHabitModal(null)}>
          <HabitForm onSave={handleSaveHabit} onClose={() => setHabitModal(null)} />
        </Modal>
      )}
    </div>
  )
}
