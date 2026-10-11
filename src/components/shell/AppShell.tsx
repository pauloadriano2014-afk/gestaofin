'use client'

import { useState } from 'react'
import { Home, ListOrdered, Wallet, PieChart, FileText, Menu, X } from 'lucide-react'

export type Section = 'inicio' | 'lancamentos' | 'contas' | 'categorias' | 'relatorios'

export const NAV_ITEMS: { id: Section; label: string; icon: any }[] = [
  { id: 'inicio', label: 'Início', icon: Home },
  { id: 'lancamentos', label: 'Lançamentos', icon: ListOrdered },
  { id: 'contas', label: 'Contas e Cartões', icon: Wallet },
  { id: 'categorias', label: 'Categorias', icon: PieChart },
  { id: 'relatorios', label: 'Relatórios', icon: FileText },
]

export interface ShellMenuItem { label: string; hint: string; icon: any; run: () => void }

// Estrutura da tela: menu lateral no computador, barra inferior no celular.
// Não tem regra de negócio: só organiza a navegação e a moldura da página.
export function AppShell({
  theme, section, onSection, accent, logoSrc, logoClass = '', badges = {}, cadastros,
  proSlot, userSlot, themeSlot, children,
}: any) {
  const [moreOpen, setMoreOpen] = useState(false)

  const navButton = (item: typeof NAV_ITEMS[number], layout: 'side' | 'bottom') => {
    const active = section === item.id
    const Icon = item.icon
    const badge = badges[item.id]
    if (layout === 'side') {
      return (
        <button key={item.id} onClick={() => onSection(item.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${active ? theme.navActive : theme.navInactive}`}>
          <Icon className="w-5 h-5 shrink-0" />
          <span className="flex-1 text-left">{item.label}</span>
          {badge > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white">{badge}</span>}
        </button>
      )
    }
    return (
      <button key={item.id} onClick={() => onSection(item.id)} className={`relative flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-bold transition-all ${active ? theme.text : theme.textMuted}`}>
        <span className={`px-4 py-1 rounded-full ${active ? theme.navActive : ''}`}><Icon className="w-5 h-5" /></span>
        <span className="truncate max-w-full">{item.id === 'contas' ? 'Contas' : item.label}</span>
        {badge > 0 && <span className="absolute top-1 right-[22%] text-[9px] font-bold px-1 rounded-full bg-red-500 text-white">{badge}</span>}
      </button>
    )
  }

  return (
    <div className="min-h-screen w-full">
      {/* MENU LATERAL (computador) */}
      <aside className={`hidden md:flex fixed inset-y-0 left-0 w-60 flex-col gap-4 p-4 border-r ${theme.card} rounded-none`}>
        <img src={logoSrc} alt="KORE" className={`h-14 w-auto object-contain self-start ${logoClass}`} />
        <nav className="space-y-1">{NAV_ITEMS.map((i) => navButton(i, 'side'))}</nav>

        <div className="space-y-1 pt-3 border-t border-black/5">
          <p className={`px-3 text-[10px] font-bold uppercase tracking-wider ${theme.textMuted}`}>Cadastros</p>
          {cadastros.map((item: ShellMenuItem) => (
            <button key={item.label} onClick={item.run} title={item.hint} className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all ${theme.navInactive}`}>
              <item.icon className="w-4 h-4 shrink-0" /> <span className="text-left">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-auto flex items-center gap-3 flex-wrap">
          {proSlot}
          {userSlot}
          {themeSlot}
        </div>
      </aside>

      {/* TOPO (celular) */}
      <header className={`md:hidden flex items-center justify-between px-4 py-2 border-b ${theme.card} rounded-none`}>
        <img src={logoSrc} alt="KORE" className={`h-9 w-auto object-contain ${logoClass}`} />
        <div className="flex items-center gap-2">{proSlot}{userSlot}</div>
      </header>

      {/* CONTEÚDO */}
      <div className="md:pl-60 pb-24 md:pb-8">
        <div className={`h-1 w-full ${accent.bar} transition-colors`} />
        <div className="max-w-6xl mx-auto px-4 md:px-8">{children}</div>
      </div>

      {/* BARRA INFERIOR (celular) */}
      <nav className={`md:hidden fixed bottom-0 inset-x-0 z-40 flex border-t ${theme.card} rounded-none`}>
        {NAV_ITEMS.map((i) => navButton(i, 'bottom'))}
        <button onClick={() => setMoreOpen(true)} className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-bold ${theme.textMuted}`}>
          <span className="px-4 py-1"><Menu className="w-5 h-5" /></span>Mais
        </button>
      </nav>

      {/* "MAIS" (celular): cadastros e tema */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMoreOpen(false)} />
          <div className={`relative w-full rounded-t-2xl p-4 space-y-2 ${theme.card} ${theme.text}`}>
            <div className="flex items-center justify-between mb-1">
              <p className="font-bold">Cadastros</p>
              <button onClick={() => setMoreOpen(false)} className={theme.textMuted}><X className="w-5 h-5" /></button>
            </div>
            {cadastros.map((item: ShellMenuItem) => (
              <button key={item.label} onClick={() => { setMoreOpen(false); item.run() }} className={`w-full flex items-start gap-3 px-3 py-2 rounded-xl text-left ${theme.cardHover}`}>
                <item.icon className="w-5 h-5 mt-0.5 shrink-0" />
                <span><span className="block text-sm font-bold">{item.label}</span><span className={`block text-[11px] ${theme.textMuted}`}>{item.hint}</span></span>
              </button>
            ))}
            <div className="pt-2 flex items-center gap-3">{themeSlot}</div>
          </div>
        </div>
      )}
    </div>
  )
}
