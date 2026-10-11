'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'

// Avisa quando saiu uma versão nova do app enquanto esta aba estava aberta.
// Uma aba antiga continua rodando o código antigo (inclusive bugs já corrigidos)
// até ser recarregada, então comparamos a versão desta aba com a do servidor.
export function UpdateBanner() {
  const mine = process.env.NEXT_PUBLIC_APP_VERSION || 'local'
  const [stale, setStale] = useState(false)

  useEffect(() => {
    if (mine === 'local') return
    let alive = true
    const check = async () => {
      try {
        const r = await fetch('/api/health', { cache: 'no-store' })
        const j = await r.json()
        if (alive && j?.commit && j.commit !== 'local' && j.commit !== mine) setStale(true)
      } catch { /* sem rede: tenta de novo depois */ }
    }
    check()
    const id = setInterval(check, 60_000)
    const onFocus = () => check()
    window.addEventListener('focus', onFocus)
    return () => { alive = false; clearInterval(id); window.removeEventListener('focus', onFocus) }
  }, [mine])

  if (!stale) return null
  return (
    <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-2.5 text-sm text-blue-700 dark:text-blue-300">
      <span>Saiu uma versão nova do sistema. Atualize para usar as correções.</span>
      <button onClick={() => window.location.reload()} className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-xs font-bold text-white">
        <RefreshCw className="w-3.5 h-3.5" /> Atualizar agora
      </button>
    </div>
  )
}
