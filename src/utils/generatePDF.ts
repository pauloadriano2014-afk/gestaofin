import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Função auxiliar para carregar a imagem e converter para Base64
async function getBase64ImageFromUrl(imageUrl: string): Promise<string> {
  try {
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Erro ao carregar logo:", error);
    return ""; 
  }
}

// Função de Limpeza Pesada (Remove emojis e corrige caracteres estranhos)
function cleanTextForPDF(text: string) {
  return text
    // 1. Remove formatação Markdown
    .replace(/\*\*/g, "") // Remove negrito
    .replace(/###/g, "")  // Remove títulos
    .replace(/##/g, "")
    .replace(/#/g, "")
    
    // 2. Substitui caracteres "inteligentes" que quebram o PDF por versões simples
    .replace(/[\u2018\u2019]/g, "'") // Aspas simples curvas
    .replace(/[\u201C\u201D]/g, '"') // Aspas duplas curvas
    .replace(/[\u2013\u2014]/g, "-") // Travessões (En-dash, Em-dash) vira hífen comum
    .replace(/\u2026/g, "...")       // Reticências (...)

    // 3. Remove Emojis e Símbolos Gráficos (Faixa Unicode Estendida)
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "") 
    .replace(/[^\x00-\x7F\xC0-\xFF\s]/g, "") // Mantém apenas ASCII básico e Acentos

    // 4. Ajuste final
    .trim();
}

export const generatePDF = async (
  stats: any, 
  aiText: string, 
  period: { start: string, end: string }, 
  filterType: string = 'all',
  isPro: boolean = false // NOVO PARÂMETRO
) => {
  const doc = new jsPDF();

  // 1. CARREGAR LOGO
  const logoBase64 = await getBase64ImageFromUrl('/logo.png');

  // --- CABEÇALHO ---
  if (logoBase64) {
    // Adiciona SOMENTE a Logo
    doc.addImage(logoBase64, 'PNG', 14, 10, 40, 40); 
  } else {
    // Fallback
    doc.setFontSize(22);
    doc.setTextColor(40, 40, 40);
    doc.text("KORE", 14, 20);
  }

  // Data de geração
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 150, 20);

  // Linha divisória
  doc.setDrawColor(200, 200, 200);
  doc.line(14, 55, 196, 55); 

  // --- TÍTULO DO RELATÓRIO ---
  const titles: any = {
    'all': 'Relatório Executivo: Visão Geral',
    'pf': 'Relatório Executivo: Pessoa Física',
    'pj': 'Relatório Executivo: Pessoa Jurídica'
  };
  const titleText = titles[filterType] || titles['all'];

  // --- 2. RESUMO DO PERÍODO ---
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(`${titleText} (${period.start} a ${period.end})`, 14, 65);

  // Card de Saldo
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(14, 70, 182, 25, 3, 3, 'F');
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("Saldo Líquido", 20, 80);
  doc.text("Receita Total", 80, 80);
  doc.text("Despesas Totais", 140, 80);

  doc.setFontSize(12);
  doc.setTextColor(0);
  
  // Cores dinâmicas
  const balance = stats.balance;
  doc.setTextColor(balance >= 0 ? 0 : 200, balance >= 0 ? 150 : 0, 0); 
  doc.text(`R$ ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 20, 88);
  
  doc.setTextColor(0, 150, 0);
  doc.text(`R$ ${stats.income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 80, 88);

  doc.setTextColor(200, 0, 0);
  doc.text(`R$ ${stats.expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 140, 88);

  // --- 3. ÁREA DA IA (LÓGICA CONDICIONAL) ---
  doc.setFontSize(12);
  let finalY = 118; // Posição padrão para começar a tabela

  if (isPro) {
      // === CENÁRIO PRO (ANÁLISE COMPLETA) ===
      doc.setTextColor(0, 0, 0);
      doc.text("Parecer do CFO Virtual:", 14, 110);

      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      
      const cleanAiText = cleanTextForPDF(aiText);
      const splitText = doc.splitTextToSize(cleanAiText, 180);
      doc.text(splitText, 14, 118);
      
      // Calcula onde a tabela deve começar baseado no tamanho do texto
      finalY = 118 + (splitText.length * 5) + 10;

  } else {
      // === CENÁRIO FREE (TEASER DE MARKETING) ===
      doc.setTextColor(150, 150, 150); // Título cinza claro para indicar bloqueio
      doc.text("Parecer do CFO Virtual (Bloqueado):", 14, 110);
      
      // Fundo do cartão de marketing
      doc.setFillColor(250, 250, 250); 
      doc.roundedRect(14, 115, 182, 30, 2, 2, 'F');
      
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.text("Esta análise avançada de inteligência artificial é exclusiva para membros PRO.", 18, 125);
      doc.text("Assine o KORE Premium para desbloquear recomendações estratégicas.", 18, 132);
      
      // Link simulado (azul)
      doc.setTextColor(59, 130, 246); 
      doc.text("Acesse o sistema para assinar agora.", 18, 139);

      finalY = 160; // Espaço fixo após o box de marketing
  }

  // --- 4. TABELA DE TRANSAÇÕES ---
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text("Detalhamento de Transações", 14, finalY);

  const tableData = stats.transactions.map((t: any) => [
    t.date.split('-').reverse().join('/'),
    cleanTextForPDF(t.description),
    t.type === 'income' ? 'Entrada' : 'Saída',
    `R$ ${Number(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
  ]);

  autoTable(doc, {
    startY: finalY + 5,
    head: [['Data', 'Descrição', 'Tipo', 'Valor']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [124, 58, 237] }, // Roxo KORE
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 25 },
      3: { halign: 'right' }
    }
  });

  // --- 5. SALVAR ---
  const suffix = isPro ? filterType.toUpperCase() : `${filterType.toUpperCase()}_FREE`;
  doc.save(`Relatorio_KORE_${suffix}_${period.start}_${period.end}.pdf`);
};