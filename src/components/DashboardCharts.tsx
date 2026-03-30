import { TrendingUp, Target, AlertTriangle, PieChart as PieChartIcon } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, PieChart, Pie, Cell, Legend } from 'recharts';

// Paleta de cores premium para as categorias no gráfico de rosca
const COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e', '#6366f1', '#0ea5e9'];

export function DashboardCharts({ theme, processedData, currentTheme, formatCurrency, setSelectedCategory, setBudgetModalOpen }: any) {
  
  // Filtra apenas as categorias que tiveram gastos reais no mês para desenhar a pizza
  const pieData = processedData.categoryStats.filter((c: any) => c.value > 0);

  return (
    <div className="flex flex-col gap-6">
      
      {/* 1. GRÁFICO DE ÁREA (Agora em tela cheia para melhor visualização) */}
      <div className={`w-full ${theme.card} p-6 rounded-2xl border flex flex-col h-[350px] lg:h-[400px]`}>
        <h3 className={`text-sm font-bold mb-6 flex items-center gap-2 ${theme.textMuted}`}>
          <TrendingUp className="w-4 h-4" /> Fluxo de Caixa Limpo (Sem Cartão/Inv)
        </h3>
        <div className="flex-1 w-full">
          {processedData.dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={processedData.dailyData}>
                <defs>
                  <linearGradient id="colorEntrada" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorSaida" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={currentTheme === 'dark' ? '#27272a' : '#e2e8f0'} vertical={false} />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(val) => `R$${val}`} tickLine={false} axisLine={false} width={60} />
                <RechartsTooltip contentStyle={{ backgroundColor: currentTheme === 'dark' ? '#18181b' : '#fff', border: 'none', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Area type="monotone" dataKey="entrada" name="Entrada" stroke="#10b981" fillOpacity={1} fill="url(#colorEntrada)" strokeWidth={2} />
                <Area type="monotone" dataKey="saida" name="Saída" stroke="#ef4444" fillOpacity={1} fill="url(#colorSaida)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : ( <div className={`h-full flex items-center justify-center text-sm ${theme.textMuted}`}>Sem dados suficientes.</div> )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 2. NOVO GRÁFICO DE ROSCA (Despesas por Categoria) */}
        <div className={`${theme.card} p-6 rounded-2xl border flex flex-col h-[380px]`}>
          <h3 className={`text-sm font-bold mb-2 flex items-center gap-2 ${theme.textMuted}`}>
            <PieChartIcon className="w-4 h-4" /> Distribuição de Despesas
          </h3>
          <div className="flex-1 w-full relative">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    nameKey="name"
                  >
                    {pieData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ backgroundColor: currentTheme === 'dark' ? '#18181b' : '#fff', border: 'none', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', color: currentTheme === 'dark' ? '#fff' : '#000' }}
                    itemStyle={{ color: currentTheme === 'dark' ? '#fff' : '#000' }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={80}
                    content={(props) => {
                      const { payload } = props;
                      return (
                        <ul className="flex flex-wrap justify-center gap-x-3 gap-y-2 mt-4 overflow-y-auto max-h-20 custom-scrollbar">
                          {payload?.map((entry, index) => (
                            <li key={`item-${index}`} className="flex items-center text-[10px] text-gray-500 dark:text-gray-400">
                              <span className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: entry.color }} />
                              {entry.value}
                            </li>
                          ))}
                        </ul>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className={`h-full flex items-center justify-center text-sm ${theme.textMuted}`}>Sem despesas registradas.</div>
            )}
            
            {/* Valor total no centro do Donut */}
            {pieData.length > 0 && (
               <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-12">
                 <span className={`text-[10px] uppercase font-bold tracking-widest ${theme.textMuted}`}>Total</span>
                 <span className={`text-lg font-bold ${theme.text}`}>
                   {formatCurrency(pieData.reduce((acc: number, curr: any) => acc + curr.value, 0))}
                 </span>
               </div>
            )}
          </div>
        </div>

        {/* 3. METAS ORÇAMENTÁRIAS */}
        <div className={`lg:col-span-2 ${theme.card} p-6 rounded-2xl border flex flex-col h-[380px]`}>
          <h3 className={`text-sm font-bold mb-4 flex items-center justify-between ${theme.textMuted}`}>
            <span className="flex items-center gap-2"><Target className="w-4 h-4" /> Metas Orçamentárias</span>
            <span className={`text-[10px] uppercase px-2 py-1 rounded ${currentTheme === 'dark' ? 'bg-zinc-800' : 'bg-gray-100'}`}>Clique para editar</span>
          </h3>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-5 custom-scrollbar">
            {processedData.categoryStats?.map((item: any, idx: number) => {
              const percentage = item.budget > 0 ? (item.value / item.budget) * 100 : 0;
              let barColor = "bg-emerald-500"; 
              let textColor = "text-emerald-500";
              
              if (percentage >= 75) { barColor = "bg-amber-500"; textColor = "text-amber-500"; }
              if (percentage >= 100) { barColor = "bg-red-500"; textColor = "text-red-500"; }

              return (
                <div 
                  key={idx} 
                  className={`group cursor-pointer p-2 -mx-2 rounded-lg transition-all ${theme.cardHover}`}
                  onClick={() => { setSelectedCategory(item); setBudgetModalOpen(true); }}
                >
                  <div className="flex justify-between text-xs mb-2">
                    <span className={`font-bold flex items-center gap-2 ${theme.text}`}>
                      {item.name}
                      {percentage >= 100 && <AlertTriangle className="w-3 h-3 text-red-500 animate-pulse" />}
                    </span>
                    <span className={`font-mono ${theme.textMuted}`}>
                      <span className={percentage >= 100 ? "text-red-500 font-bold" : theme.text}>{formatCurrency(item.value)}</span>
                      <span className="opacity-50"> / {item.budget > 0 ? Number(item.budget).toLocaleString('pt-BR', { minimumFractionDigits: 0 }) : '∞'}</span>
                    </span>
                  </div>
                  <div className={`w-full rounded-full h-3 overflow-hidden relative ${currentTheme === 'dark' ? 'bg-zinc-950' : 'bg-gray-100'}`}>
                    <div className={`h-full rounded-full transition-all duration-1000 ease-out ${barColor}`} style={{ width: `${Math.min(percentage, 100)}%` }} />
                  </div>
                  <div className="flex justify-end mt-1">
                    <span className={`text-[9px] font-bold ${textColor}`}>
                      {item.budget > 0 ? `${percentage.toFixed(0)}%` : 'Sem meta'}
                    </span>
                  </div>
                </div>
              )
            })}
            {(!processedData.categoryStats || processedData.categoryStats.length === 0) && (
              <div className={`text-center text-xs mt-10 ${theme.textMuted}`}>Nenhuma despesa ou meta registrada.</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}