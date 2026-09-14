import { Component } from 'react'
import { AlertTriangle, RotateCw } from 'lucide-react'

// Sin esto, cualquier error de render deja la pantalla en blanco sin explicación.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Error de render:', error, info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full card p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={18} className="text-red-400" />
            </div>
            <h1 className="font-semibold text-zinc-100">Algo se rompió en esta pantalla</h1>
          </div>
          <p className="text-sm text-zinc-400 mb-4">
            El resto de la aplicación sigue bien. Recarga para volver; si se repite siempre
            en el mismo sitio, el detalle técnico está abajo.
          </p>
          <pre className="text-xs text-zinc-500 bg-zinc-950 border border-zinc-800 rounded-lg p-3 overflow-x-auto mb-4">
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <button onClick={() => window.location.reload()} className="btn-primary w-full justify-center">
            <RotateCw size={15} /> Recargar
          </button>
        </div>
      </div>
    )
  }
}
