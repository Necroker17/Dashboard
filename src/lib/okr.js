// Un resultado clave puede ir hacia arriba (cerrar 30 pedidos) o hacia abajo
// (bajar el CPA de 12 a 8). La fórmula ingenua actual/objetivo solo sirve para
// los primeros: para "bajar a 8" estando en 9,20 daría 115% en vez de 70%.
export function krProgress(kr) {
  const start = Number(kr.start_value ?? 0)
  const target = Number(kr.target_value ?? 0)
  const current = Number(kr.current_value ?? 0)
  const span = kr.direction === 'decrease' ? start - target : target - start
  if (!span) return current >= target ? 100 : 0
  const done = kr.direction === 'decrease' ? start - current : current - start
  return Math.max(0, Math.min(100, Math.round((done / span) * 100)))
}

// El avance de un objetivo es la media de sus resultados clave.
export const objectiveProgress = (keyResults) =>
  keyResults.length
    ? Math.round(keyResults.reduce((sum, kr) => sum + krProgress(kr), 0) / keyResults.length)
    : 0
