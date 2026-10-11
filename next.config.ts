import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Versão (commit) que está rodando, para mostrar na tela e em /api/health.
  // No Render a variável RENDER_GIT_COMMIT já vem preenchida.
  env: {
    NEXT_PUBLIC_APP_VERSION: (process.env.RENDER_GIT_COMMIT || 'local').slice(0, 7),
  },
  reactCompiler: true,
};

export default nextConfig;
