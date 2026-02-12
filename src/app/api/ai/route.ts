import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { prompt, categories } = await req.json();

    // --- SUA CHAVE CONFIGURADA ---
    const API_KEY = process.env.OPENAI_API_KEY; 
    // --------------------------------

    // CORREÇÃO: Verificamos apenas se a chave existe.
    // Antes estava verificando se ela era igual a ela mesma e bloqueando.
    if (!API_KEY) {
      throw new Error("Chave de API não foi inserida no código.");
    }

    // Configuração para OpenAI (GPT-4o-mini ou GPT-3.5-turbo)
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
            content: `Você é um assistente financeiro pessoal.
            Sua tarefa: Analisar a frase do usuário e extrair os dados da transação.
            
            Categorias disponíveis no banco de dados: ${categories.map((c: any) => c.name).join(", ")}.
            
            Regras:
            1. Se não mencionar categoria, tente deduzir pelo contexto (ex: "Posto" -> Transporte).
            2. Se for gasto, type = 'expense'. Se for ganho/salário, type = 'income'.
            3. Retorne APENAS um JSON válido, sem markdown (nada de \`\`\`json).

            Formato de Saída Obrigatório:
            {
              "description": "string (descrição curta e clara)",
              "amount": number (apenas números, ex: 50.50),
              "categoryName": "string (nome exato da categoria)",
              "type": "income" ou "expense"
            }`
          },
          { role: "user", content: prompt }
        ],
        temperature: 0, // Zero criatividade, máxima precisão
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