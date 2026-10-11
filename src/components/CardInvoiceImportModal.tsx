'use client'

import { useState, useEffect } from 'react'
import { X, Upload, Loader2, CreditCard, FileText, Plus } from 'lucide-react'
import { getUserCreditCards, createCreditCard, updateCreditCard } from '@/app/creditCardActions'
import { getOwnersAndAccounts } from '@/app/ownerActions'
import { processCardInvoiceWithAI, saveBulkCardInvoiceTransactions, parsePdfInvoiceText } from '@/app/actions'
import { parseCardInvoiceCsv, parseOfx, parseOfxTotal } from '@/utils/importParsers'
import { ImportReviewModal } from '@/components/ImportReviewModal'
import { getInvoiceCycleForDate, dueMonthForCycleKey } from '@/utils/creditCard'

const BATCH_SIZE = 15
const NEW_CARD_VALUE = '__new__'

// 🔥 NOVO: importar os itens da fatura de um cartão de uma vez (CSV, OFX ou
// PDF) em vez de lançar compra por compra. Cada item nasce vinculado ao
// cartão escolhido e categorizado pela IA (reaproveitando a mesma tela de
// revisão do importador de extrato bancário).
//
// 🔥 NOVO: não exige mais passar por "Meus Cartões" antes — dá pra cadastrar
// um cartão novo direto aqui (nome, dia de fechamento e vencimento) e seguir
// pra importação sem sair da tela, num fluxo só.
export function CardInvoiceImportModal({ categories, onClose, pendingFixedBills = [] }: { categories: any[]; onClose: () => void; pendingFixedBills?: any[] }) {
  const [cards, setCards] = useState<any[]>([])
  const [owners, setOwners] = useState<any[]>([])
  const [loadingCards, setLoadingCards] = useState(true)
  const [selectedCardId, setSelectedCardId] = useState('')

  const [newCardName, setNewCardName] = useState('')
  const [newCardClosingDay, setNewCardClosingDay] = useState('')
  const [newCardDueDay, setNewCardDueDay] = useState('')
  const [newCardOwner, setNewCardOwner] = useState('')
  // O que o próprio arquivo diz da fatura: vencimento e total (quando o formato traz).
  const [fileMeta, setFileMeta] = useState<{ dueDate?: string | null; total?: number | null; closingDay?: number | null }>({})
  const [isSavingCard, setIsSavingCard] = useState(false)

  const [uploadStatus, setUploadStatus] = useState('')
  const [isReviewOpen, setIsReviewOpen] = useState(false)
  // Mês em que a fatura importada VENCE (AAAA-MM). Todos os itens vão pra essa fatura.
  const [dueMonth, setDueMonth] = useState('')
  const [reviewTransactions, setReviewTransactions] = useState<any[]>([])
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    getUserCreditCards().then((res) => {
      setCards(res)
      if (res.length === 1) setSelectedCardId(res[0].id)
      else if (res.length === 0) setSelectedCardId(NEW_CARD_VALUE)
      setLoadingCards(false)
    }).catch(() => setLoadingCards(false))
  }, [])

  // Cria o cartão sozinho a partir do arquivo: o dia de vencimento vem da fatura (se o arquivo
  // trouxer); fechamento aproximado (7 dias antes), pois todos os itens importados vão para a
  // fatura escolhida mesmo. Só o nome é obrigatório.
  async function createCardFromFile(meta: { dueDate?: string | null; closingDay?: number | null }): Promise<any | null> {
    const dueFromFile = meta.dueDate ? Number(meta.dueDate.slice(8, 10)) : 0
    const dueDay = Number(newCardDueDay) || dueFromFile || 10
    const closingDay = Number(newCardClosingDay) || meta.closingDay || (dueDay > 7 ? dueDay - 7 : dueDay + 23)
    const res = await createCreditCard({ name: newCardName.trim(), closingDay, dueDay, ownerId: newCardOwner || null })
    if (!res.success) { alert(res.message || 'Erro ao cadastrar o cartão.'); return null }
    const previousIds = new Set(cards.map((c: any) => c.id))
    const updated = await getUserCreditCards()
    setCards(updated)
    const created = updated.find((c: any) => !previousIds.has(c.id))
    if (!created) return null
    setSelectedCardId(created.id)
    setNewCardName(''); setNewCardClosingDay(''); setNewCardDueDay('')
    return created
  }

  async function processRawRows(rawRows: { date: string; amount: number; description: string }[], meta: { dueDate?: string | null; total?: number | null; closingDay?: number | null } = {}) {
    if (rawRows.length === 0) {
      alert('Não encontrei nenhum item nesse arquivo. Confira se é mesmo o extrato/fatura do cartão.')
      setUploadStatus('')
      return
    }

    // cartão novo: cadastra agora, já com o vencimento lido do arquivo
    let card = cards.find((c: any) => c.id === selectedCardId)
    if (selectedCardId === NEW_CARD_VALUE) {
      setUploadStatus('Cadastrando o cartão...')
      card = await createCardFromFile(meta)
      if (!card) { setUploadStatus(''); return }
    }

    const totalBatches = Math.ceil(rawRows.length / BATCH_SIZE)
    let allProcessed: any[] = []

    for (let i = 0; i < rawRows.length; i += BATCH_SIZE) {
      const loteAtual = Math.floor(i / BATCH_SIZE) + 1
      setUploadStatus(`IA analisando lote ${loteAtual} de ${totalBatches}...`)
      const batch = rawRows.slice(i, i + BATCH_SIZE)
      const result = await processCardInvoiceWithAI(batch)
      if (result.success && result.data) {
        allProcessed = [...allProcessed, ...result.data]
      }
    }

    setUploadStatus('')

    if (allProcessed.length > 0) {
      setFileMeta(meta)
      if (meta.dueDate) {
        // vencimento lido do próprio arquivo
        setDueMonth(meta.dueDate.slice(0, 7))
      } else if (card) {
        // Palpite do vencimento: a fatura em que cai o item mais recente do arquivo
        // (o usuário pode corrigir na revisão).
        const latest = allProcessed.map((t: any) => t.date).filter(Boolean).sort().slice(-1)[0]
        if (latest) {
          const key = getInvoiceCycleForDate(latest, card.closingDay, card.dueDay).cycleKey
          setDueMonth(dueMonthForCycleKey(key, card.closingDay, card.dueDay))
        }
      }
      setReviewTransactions(allProcessed)
      setIsReviewOpen(true)
    } else {
      alert('Nenhum item válido foi processado pela IA. Tente novamente.')
    }
  }

  function handleFileChange(event: any) {
    const file = event.target.files?.[0]
    if (!file) return
    const isNew = selectedCardId === NEW_CARD_VALUE
    if (!selectedCardId || (isNew && !newCardName.trim())) {
      alert('Escolha o cartão ou, se for novo, digite o nome dele.')
      event.target.value = null
      return
    }

    const name = file.name.toLowerCase()

    if (name.endsWith('.csv')) {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const text = e.target?.result as string
        setUploadStatus('Lendo CSV...')
        const rawRows = parseCardInvoiceCsv(text)
        await processRawRows(rawRows)
      }
      reader.readAsText(file)
    } else if (name.endsWith('.ofx')) {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const text = e.target?.result as string
        setUploadStatus('Lendo OFX...')
        const rawRows = parseOfx(text)
        await processRawRows(rawRows, { total: parseOfxTotal(text) })
      }
      reader.readAsText(file)
    } else if (name.endsWith('.pdf')) {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string
        const base64 = dataUrl.split(',')[1] || ''
        setUploadStatus('Extraindo texto do PDF...')
        const res: any = await parsePdfInvoiceText(base64)
        if (!res.success || !res.data) {
          alert(res.message || 'Não consegui ler esse PDF.')
          setUploadStatus('')
          return
        }
        await processRawRows(res.data, res.meta || {})
      }
      reader.readAsDataURL(file)
    } else {
      alert('Formato não suportado. Envie um arquivo .csv, .ofx ou .pdf da fatura.')
    }

    event.target.value = null
  }

  async function handleConfirmImport(finalTransactions: any[]) {
    setIsSaving(true)
    const res = await saveBulkCardInvoiceTransactions(finalTransactions, selectedCardId, dueMonth || undefined)
    // O arquivo trouxe vencimento/fechamento diferentes do cadastrado no cartão: oferece atualizar
    // (assim a aba Cartões mostra as datas certas)
    const fileDueDay = fileMeta.dueDate ? Number(fileMeta.dueDate.slice(8, 10)) : 0
    const fileClosingDay = fileMeta.closingDay || 0
    const cardNow = cards.find((c: any) => c.id === selectedCardId)
    const dueDiffers = !!fileDueDay && !!cardNow && fileDueDay !== cardNow.dueDay
    const closeDiffers = !!fileClosingDay && !!cardNow && fileClosingDay !== cardNow.closingDay
    if (res.success && cardNow && (dueDiffers || closeDiffers)) {
      const newClosing = fileClosingDay || cardNow.closingDay
      const newDue = fileDueDay || cardNow.dueDay
      if (confirm(`Este arquivo indica fechamento dia ${newClosing} e vencimento dia ${newDue}, mas o cartão "${cardNow.name}" está com fechamento ${cardNow.closingDay} e vencimento ${cardNow.dueDay}. Atualizar o cartão?`)) {
        await updateCreditCard(cardNow.id, { name: cardNow.name, closingDay: newClosing, dueDay: newDue, ownerId: cardNow.ownerId || null })
      }
    }
    setIsSaving(false)

    if (res.success) {
      const dup = (res as any).skippedDuplicates || 0
      alert(dup > 0
        ? `Pronto! ${(res as any).imported ?? finalTransactions.length - dup} item(ns) novo(s) salvo(s). ${dup} já existiam neste cartão e foram ignorados (sem duplicar).`
        : `Sucesso! ${finalTransactions.length} itens da fatura salvos.`)
      setIsReviewOpen(false)
      setReviewTransactions([])
      onClose()
    } else {
      alert(res.message || 'Erro ao salvar os itens da fatura.')
    }
  }

  useEffect(() => { getOwnersAndAccounts().then((r) => setOwners(r.owners)) }, [])

  const selectedCard = cards.find((c: any) => c.id === selectedCardId)
  const canUpload = !!selectedCard || (selectedCardId === NEW_CARD_VALUE && !!newCardName.trim())

  return (
    <>
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
        <div className="bg-zinc-900 border border-zinc-800 w-full max-w-[95vw] sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl p-6 shadow-2xl relative">

          <div className="flex justify-between items-center sticky top-0 bg-zinc-900 z-10 pb-4 mb-2 border-b border-zinc-800/50">
            <h2 className="text-xl font-bold flex items-center gap-2 text-white">
              <Upload className="w-5 h-5 text-blue-500" /> Importar Fatura de Cartão
            </h2>
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          <p className="text-xs text-zinc-500 mb-4">
            Registra os itens da fatura de uma vez, cada um categorizado pela IA e já vinculado ao cartão escolhido — sem lançar compra por compra. Aceita .csv, .ofx ou .pdf.
          </p>

          {loadingCards ? (
            <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 block flex items-center gap-1">
                  <CreditCard className="w-3 h-3" /> Qual cartão é essa fatura?
                </label>
                <select
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-blue-600 transition-all appearance-none"
                  value={selectedCardId}
                  onChange={(e) => setSelectedCardId(e.target.value)}
                >
                  {cards.length === 0 && <option value="">Selecione...</option>}
                  {cards.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                  <option value={NEW_CARD_VALUE}>+ Cadastrar novo cartão</option>
                </select>
              </div>

              {selectedCardId === NEW_CARD_VALUE && (
                <div className="space-y-2 border border-dashed border-blue-500/40 rounded-xl p-3 bg-blue-500/5">
                  <p className="text-[10px] text-zinc-500 mb-1">
                    Só o nome e de quem é o cartão. O vencimento eu leio da fatura (PDF) quando der; o cartão é cadastrado sozinho ao escolher o arquivo.
                  </p>
                  <input
                    type="text"
                    placeholder="Nome do cartão (ex: Itaú Adri)"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white outline-none focus:border-blue-600 transition-all"
                    value={newCardName}
                    onChange={(e) => setNewCardName(e.target.value)}
                  />
                  {owners.length > 0 && (
                    <select
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white outline-none focus:border-blue-600 transition-all"
                      value={newCardOwner}
                      onChange={(e) => setNewCardOwner(e.target.value)}
                    >
                      <option value="">De quem é o cartão?</option>
                      {owners.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  )}
                  <details className="text-[10px] text-zinc-500">
                    <summary className="cursor-pointer">Informar dia de fechamento e vencimento (opcional)</summary>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <input type="number" min={1} max={31} placeholder="Dia fechamento" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white outline-none focus:border-blue-600" value={newCardClosingDay} onChange={(e) => setNewCardClosingDay(e.target.value)} />
                      <input type="number" min={1} max={31} placeholder="Dia vencimento" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white outline-none focus:border-blue-600" value={newCardDueDay} onChange={(e) => setNewCardDueDay(e.target.value)} />
                    </div>
                  </details>
                </div>
              )}

              {uploadStatus ? (
                <div className="border border-dashed border-blue-500/40 rounded-xl p-6 flex flex-col items-center justify-center gap-2 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  <p className="text-sm text-blue-400 font-medium">{uploadStatus}</p>
                </div>
              ) : (
                <label className={`border border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 text-center transition-all cursor-pointer ${canUpload ? 'border-zinc-700 hover:border-blue-500 text-zinc-400 hover:text-blue-400' : 'border-zinc-800 text-zinc-600 cursor-not-allowed'}`}>
                  <FileText className="w-6 h-6" />
                  <p className="text-sm font-bold">Clique pra escolher o arquivo da fatura</p>
                  <p className="text-[10px] text-zinc-600">.csv, .ofx ou .pdf</p>
                  <input type="file" accept=".csv,.ofx,.pdf" className="hidden" onChange={handleFileChange} disabled={!canUpload} />
                </label>
              )}

              {selectedCard && (
                <p className="text-[10px] text-zinc-600 text-center">Os itens serão lançados como despesas do cartão &quot;{selectedCard.name}&quot;, pendentes até você pagar a fatura na tela de Cartões.</p>
              )}
            </div>
          )}
        </div>
      </div>

      <ImportReviewModal
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        initialTransactions={reviewTransactions}
        categories={categories}
        onConfirm={handleConfirmImport}
        isSaving={isSaving}
        pendingFixedBills={pendingFixedBills}
        owners={owners}
        defaultOwnerId={selectedCard?.ownerId || undefined}
        flagInvoicePayments
        expectedTotal={fileMeta.total ?? null}
        headerExtra={(
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <label className="text-sm font-bold text-gray-700 dark:text-zinc-200" htmlFor="invoice-due-month">Esta fatura vence em</label>
            <input
              id="invoice-due-month"
              type="month"
              value={dueMonth}
              onChange={(e) => setDueMonth(e.target.value)}
              className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-zinc-50 text-sm rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500"
            />
            {fileMeta.dueDate && <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">vencimento {fileMeta.dueDate.split('-').reverse().join('/')} lido do arquivo</span>}
            <span className="text-xs text-gray-500 dark:text-zinc-400">Todos os itens vão para essa fatura, mesmo os de datas vizinhas (ex: compra internacional lançada dias depois).</span>
          </div>
        )}
      />
    </>
  )
}
