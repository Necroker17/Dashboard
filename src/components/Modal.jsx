import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ title, onClose, children, size = 'md' }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl', '2xl': 'max-w-3xl' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        // Un formulario largo en un móvil se salía por abajo sin forma de
        // desplazarlo: el alto se limita y el cuerpo se hace desplazable, con la
        // cabecera fija para no perder el botón de cerrar.
        className={`w-full ${sizes[size]} max-h-[calc(100dvh-2rem)] flex flex-col bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl animate-fade-in`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-zinc-800 flex-shrink-0">
          <h2 className="font-semibold text-zinc-100">{title}</h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 p-2 -mr-1 rounded-lg transition-colors"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-4 sm:p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
