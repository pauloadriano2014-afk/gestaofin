import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { prompt, categories } = await req.json();

    const API_KEY = process.env.OPENAI_API_KEY; 
    
    if (!API_KEY) {
      throw new Error("Chave de API não foi inserida no código.");
    }

    // Injetamos a data atual para a IA saber o ano caso o usuário diga "10 do 3"
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Modelo rápido e barato
        messages: [
          {
            role: "system",
            content: `Você é um assistente financeiro pessoal de alta precisão.
            Hoje é dia ${hoje.toLocaleDateString('pt-BR')} do ano de ${anoAtual}.

            Sua tarefa: Analisar a frase do usuário e extrair os dados da transação perfeitamente.
            
            Categorias disponíveis: ${categories.map((c: any) => c.name).join(", ")}.
            
            REGRAS ABSOLUTAS E OBRIGATÓRIAS:
            1. VALORES COM CENTAVOS: Se o usuário disser "e" separando números (ex: "97 e 20", "150 e 50"), isso é a vírgula dos centavos! Formate estritamente como decimal usando ponto (ex: 97.20). NUNCA junte os números (errado: 9720).
            2. DATAS DITADAS: Se o usuário disser "dia 10", "10 do 3", "10 de janeiro", monte a data no formato "YYYY-MM-DD" usando o ano atual (${anoAtual}). Se ele não ditar data nenhuma, retorne null no campo date.
            3. REGRA DA CONSULTORIA: Se a descrição contiver a palavra "Consultoria" (qualquer variação), você DEVE obrigatoriamente definir type como "income" e entityType como "pj".
            4. DEDUÇÃO: Se não mencionar categoria, tente deduzir pelo contexto. Impostos (IPVA, MEI, CREF) vão para a categoria de impostos.
            5. Retorne APENAS um JSON válido, sem markdown (nada de \`\`\`json).

            Formato de Saída Obrigatório:
            {
              "description": "string (descrição curta e clara)",
              "amount": number (apenas números com ponto para decimais, ex: 97.20),
              "categoryName": "string (nome exato da categoria)",
              "type": "income" ou "expense",
              "date": "string (formato YYYY-MM-DD) ou null se não falada",
              "entityType": "pf" ou "pj" (padrão é "pf", forçar "pj" se for consultoria)
            }`
          },
          { role: "user", content: prompt }
        ],
        temperature: 0, // Zero criatividade, máxima precisão para seguir regras
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error("Erro retornado pela OpenAI:", data.error);
      throw new Error(data.error.message || "Erro na API da OpenAI");
    }

    const content = data.choices[0].message.content;
    
    // Limpeza extra caso a IA mande markdown
    const cleanJson = content.replace(/```json|```/g, "").trim();
    
    console.log("✅ IA Processou:", cleanJson);

    return NextResponse.json(JSON.parse(cleanJson));

  } catch (error: any) {
    console.error("❌ FALHA GERAL:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}