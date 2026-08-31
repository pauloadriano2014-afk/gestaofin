'use client'

import { useState, useEffect } from 'react'
import { X, Upload, Loader2, CreditCard, FileText } from 'lucide-react'
import { getUserCreditCards } from '@/app/creditCardActions'
import { processCardInvoiceWithAI, saveBulkCardInvoiceTransactions, parsePdfInvoiceText } from '@/app/actions'
import { parseCardInvoiceCsv, parseOfx } from '@/utils/importParsers'
import { ImportReviewModal } from '@/components/ImportReviewModal'

const BATCH_SIZE = 15

// 🔥 NOVO: importar os itens da fatura de um cartão de uma vez (CSV, OFX ou
// PDF) em vez de lançar compra por compra. Cada item nasce vinculado ao
// cartão escolhido e categorizado pela IA (reaproveitando a mesma tela de
// revisão do importador de extrato bancário).
export function CardInvoiceImportModal({ categories, onClose }: { categories: any[]; onClose: () => void }) {
  const [cards, setCards] = useState<any[]>([])
  const [loadingCards, setLoadingCards] = useState(true)
  const [selectedCardId, setSelectedCardId] = useState('')

  const [uploadStatus, setUploadStatus] = useState('')
  const [isReviewOpen, setIsReviewOpen] = useState(false)
  const [reviewTransactions, setReviewTransactions] = useState<any[]>([])
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    getUserCreditCards().then((res) => {
      setCards(res)
      if (res.length === 1) setSelectedCardId(res[0].id)
      setLoadingCards(false)
    }).catch(() => setLoadingCards(false))
  }, [])

  async function processRawRows(rawRows: { date: string; amount: number; description: string }[]) {
    if (rawRows.length === 0) {
      alert('Não encontrei nenhum item nesse arquivo. Confira se é mesmo o extrato/fatura do cartão.')
      setUploadStatus('')
      return
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
      setReviewTransactions(allProcessed)
      setIsReviewOpen(true)
    } else {
      alert('Nenhum item válido foi processado pela IA. Tente novamente.')
    }
  }

  function handleFileChange(event: any) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!selectedCardId) {
      alert('Selecione primeiro a qual cartão essa fatura pertence.')
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
        await processRawRows(rawRows)
      }
      reader.readAsText(file)
    } else if (name.endsWith('.pdf')) {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string
        const base64 = dataUrl.split(',')[1] || ''
        setUploadStatus('Extraindo texto do PDF...')
        const res = await parsePdfInvoiceText(base64)
        if (!res.success || !res.data) {
          alert(res.message || 'Não consegui ler esse PDF.')
          setUploadStatus('')
          return
        }
        await processRawRows(res.data)
      }
      reader.readAsDataURL(file)
    } else {
      alert('Formato não suportado. Envie um arquivo .csv, .ofx ou .pdf da fatura.')
    }

    event.target.value = null
  }

  async function handleConfirmImport(finalTransactions: any[]) {
    setIsSaving(true)
    const res = await saveBulkCardInvoiceTransactions(finalTransactions, selectedCardId)
    setIsSaving(false)

    if (res.success) {
      alert(`Sucesso! ${finalTransactions.length} itens da fatura salvos.`)
      setIsReviewOpen(false)
      setReviewTransactions([])
      onClose()
    } else {
      alert(res.message || 'Erro ao salvar os itens da fatura.')
    }
  }

  const selectedCard = cards.find((c: any) => c.id === selectedCardId)

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
          ) : cards.length === 0 ? (
            <p className="text-sm text-zinc-500 py-4 text-center">Você ainda não cadastrou nenhum cartão. Cadastre um em &quot;Meus Cartões&quot; antes de importar a fatura.</p>
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
                  <option value="">Selecione...</option>
                  {cards.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {uploadStatus ? (
                <div className="border border-dashed border-blue-500/40 rounded-xl p-6 flex flex-col items-center justify-center gap-2 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  <p className="text-sm text-blue-400 font-medium">{uploadStatus}</p>
                </div>
              ) : (
                <label className={`border border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 text-center transition-all cursor-pointer ${selectedCardId ? 'border-zinc-700 hover:border-blue-500 text-zinc-400 hover:text-blue-400' : 'border-zinc-800 text-zinc-600 cursor-not-allowed'}`}>
                  <FileText className="w-6 h-6" />
                  <p className="text-sm font-bold">Clique pra escolher o arquivo da fatura</p>
                  <p className="text-[10px] text-zinc-600">.csv, .ofx ou .pdf</p>
                  <input type="file" accept=".csv,.ofx,.pdf" className="hidden" onChange={handleFileChange} disabled={!selectedCardId} />
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
      />
    </>
  )
}
