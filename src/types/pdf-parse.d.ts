// Declaração mínima pro pacote "pdf-parse" (sem tipos oficiais/@types).
// Usado só em src/app/actions.ts, via import dinâmico, pra extrair texto de
// PDF de fatura de cartão. Isso permite o projeto compilar mesmo antes de
// rodar "npm install" (o import dinâmico falha em runtime com uma mensagem
// amigável nesse caso, não em tempo de compilação).
declare module "pdf-parse" {
  interface PdfParseResult {
    text: string;
    numpages?: number;
    numrender?: number;
    info?: unknown;
    metadata?: unknown;
    version?: string;
  }

  function pdfParse(dataBuffer: Buffer, options?: unknown): Promise<PdfParseResult>;
  export default pdfParse;
}
