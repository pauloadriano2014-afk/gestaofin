
# KORE — correções críticas + novas funcionalidades (30/08/2026)

## O que aconteceu com as pastas

Todo o trabalho anterior (auditoria + funcionalidades novas) tinha sido feito na pasta errada (`Downloads\gestaofin-main`), uma cópia antiga desatualizada. Esta rodada foi refeita do zero direto na pasta certa (`OneDrive\Área de Trabalho\gestaofin`, a que você usa de verdade com `npm run dev`), comparando o conteúdo real de cada arquivo antes de mexer. A pasta Downloads pode ser ignorada/apagada — ela não é mais usada em nada.

## 🔴 Por que seu login local não funciona (`gestaokore@outlook.com`)

Isso não é um bug no código — é esperado. O Clerk usa **duas instâncias separadas com bancos de usuário diferentes**: uma de desenvolvimento (usada quando você roda `npm run dev`) e uma de produção (usada no site publicado). Seu `.env.local` está configurado com chaves de teste (`pk_test_...` / `sk_test_...`) apontando para a instância `touched-grackle-35.clerk.accounts.dev`. Sua conta `gestaokore@outlook.com` foi criada na instância de **produção**, então ela simplesmente não existe nesse banco de desenvolvimento — daí o erro "Não foi possível encontrar o usuário".

Duas soluções, sem mexer em código:
1. **Mais simples**: crie uma conta nova direto na tela de cadastro local (`/sign-up` rodando `npm run dev`) — não precisa ser o mesmo e-mail da produção, é só para testar localmente.
2. Se quiser literalmente a mesma conta dos dois lados, no painel do Clerk (dashboard.clerk.com) dá pra configurar as duas instâncias (dev/prod) pra compartilhar usuários, mas isso é uma mudança de configuração no Clerk, não no código.

Um detalhe à parte que também pode ter contribuído para os erros que apareceram no console: você acessou pelo IP da rede local (`192.168.18.4:3000`) em vez de `localhost:3000`. Alguns navegadores tratam esses dois endereços como "sites" diferentes para fins de cookies/armazenamento, o que pode causar comportamento estranho de sessão. Recomendo testar por `localhost:3000` quando possível.

## 🔴 Achado novo e sério: chave da Stripe em modo LIVE no ambiente local

Enquanto eu investigava, percebi que seu `.env.local` tem `STRIPE_SECRET_KEY` começando com **`sk_live_`** (produção real, dinheiro de verdade) misturada com uma chave pública `pk_test_` (teste). Isso é perigoso: qualquer teste de assinatura que você fizer rodando `npm run dev` vai tentar cobrar cartões de verdade (ou dar erro por causa da mistura teste/produção). Recomendo fortemente trocar `STRIPE_SECRET_KEY` no `.env.local` pela chave de teste (`sk_test_...`, disponível no mesmo painel da Stripe) antes de continuar testando localmente.

## 🔴 Bugs corrigidos (confirmados no código real desta vez)

1. **Assinantes pagantes ficavam presos como "free"** — o webhook da Stripe salvava o nome do plano (`monthly`, `quarterly`...) no campo que o resto do sistema compara com o texto literal `"pro"`. Como nunca batia, todo cliente que pagava continuava sem acesso PRO (a não ser que estivesse na lista VIP manual no código). Corrigido: o webhook agora sempre grava `planType: 'pro'` e guarda o nome do plano à parte, em `billingInterval`. **O script de migração incluído já corrige automaticamente quem já pagou e ficou preso como free.**
2. **Cancelamento/inadimplência nunca rebaixava o usuário** — adicionei os eventos `customer.subscription.updated`, `customer.subscription.deleted` e `invoice.payment_failed` no webhook, então agora cancelar ou ter um pagamento recusado de fato tira o acesso PRO.
3. **Webhook da Stripe era bloqueado pelo próprio login** — o middleware liberava `/api/webhooks/stripe` (plural), mas a rota real é `/api/webhook/stripe` (singular). Isso significa que a Stripe nunca conseguia confirmar nenhuma assinatura.
4. **Senha do banco Neon exposta no código-fonte** (`drizzle.config.ts`) — agora lê do `.env.local`, igual o resto do app. **Recomendo trocar a senha do banco no painel do Neon**, já que ela ficou visível no histórico do projeto.
5. **Relatório mostrava a média mensal como se fosse o total gasto no período** — no card "Gastos" dos Relatórios Avançados.
6. **Parcelamento perdia centavos** (ex: R$100 em 3x virava 33,33 × 3 = R$99,99) e podia gerar **datas inválidas** em parcelas que caíssem em fevereiro (ex: dia 31 → "31 de fevereiro"). Mesma correção aplicada em "Virar o Mês" das contas fixas.
7. **Relatórios de período (não só o mês atual) podiam incluir por engano um dia do mês seguinte**, por causa de uma conversão de fuso horário (`new Date().toISOString()`).
8. **Falha da IA (OpenAI) sem créditos/chave inválida quebrava silenciosamente** o CFO Virtual e a Análise de Período, sem nenhum aviso do motivo real — agora loga e retorna mensagem de erro clara.
9. `stripe.exe` (31 MB) estava sendo versionado no Git por engano — adicionado ao `.gitignore`. Recomendo apagar esse arquivo da pasta do projeto manualmente (não tenho permissão para apagar arquivos aí).

## ✅ Novas funcionalidades (como combinamos)

- **Contas em Aberto**: painel fixo no topo mostrando toda conta fixa vencida ou a vencer nos próximos 15 dias, independente do mês filtrado na tela.
- **Data exata da baixa**: toda vez que você marca uma conta como paga, a data fica registrada (`paidAt`).
- **Categorização que aprende com você**: automática (aprende com toda transação que você categoriza) + regras manuais editáveis na tela de etiqueta (🏷️) no topo.
- **Cartões de crédito com fatura de verdade**: cadastre cartões (dia de fechamento/vencimento), lance compras nele, parcele — e pague a fatura inteira de uma vez na tela de cartão (💳). Uma compra no cartão já conta no seu saldo assim que é lançada (mesmo critério que já era usado pelas contas fixas); "pagar a fatura" só dá baixa, não duplica o gasto.
- **Previsão do Mês**: novo painel que soma contas fixas em aberto + faturas de cartão e compara com a receita esperada, respondendo "vou conseguir pagar tudo esse mês?".

## Antes de rodar `npm run dev` de novo

1. Rode a migração do banco: `npx drizzle-kit push` (mais simples, detecta sozinho) **ou** cole `migration_correcoes_e_novas_funcionalidades.sql` no SQL editor do Neon.
2. Troque `STRIPE_SECRET_KEY` no `.env.local` pela chave de teste antes de testar pagamento localmente.
3. Considere trocar a senha do banco no Neon (ficou exposta no código antes desta correção).
4. Pode apagar a pasta `Downloads\gestaofin-main` e o arquivo `stripe.exe` — não são mais necessários.

## Verificação feita

`tsc --noEmit` no projeto completo (com o conteúdo real da sua pasta OneDrive, não mais o da Downloads): **zero erros de tipo**. `eslint` rodado também — os avisos/erros restantes (`no-explicit-any`, um padrão de `useEffect`) já existiam no código original antes de qualquer mudança minha, então mantive o estilo consistente com o resto do projeto em vez de reescrever tudo.
