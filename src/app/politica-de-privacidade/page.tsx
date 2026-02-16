export default function PoliticaPrivacidade() {
  return (
    <div className="max-w-3xl mx-auto py-16 px-6 text-zinc-400 bg-black min-h-screen">
      <h1 className="text-3xl font-bold text-white mb-8">Política de Privacidade</h1>
      
      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-white mb-3">1. Coleta de Informações</h2>
          <p>Coletamos apenas o seu nome e e-mail fornecidos através do Google Auth para identificação e acesso seguro à plataforma KORE.</p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-white mb-3">2. Uso dos Dados</h2>
          <p>Seus dados são utilizados exclusivamente para gerenciar sua conta e suas transações financeiras dentro do aplicativo.</p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-white mb-3">3. Segurança</h2>
          <p>Não compartilhamos seus dados com terceiros. Utilizamos tecnologias de criptografia para garantir que suas informações estejam protegidas.</p>
        </div>
      </section>

      <div className="mt-12 pt-8 border-t border-zinc-800">
        <button onClick={() => window.history.back()} className="text-blue-500 hover:text-blue-400 font-medium">
          ← Voltar para o App
        </button>
      </div>
    </div>
  )
}