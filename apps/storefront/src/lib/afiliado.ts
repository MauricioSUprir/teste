/**
 * Rastreio de afiliado no BeautyNow — o profissional da Be2Beauty divulga
 * https://www.beautynowstore.com.br/?af=codigo; o código fica guardado no
 * navegador do cliente por 30 dias e segue junto com o pedido, para o
 * servidor creditar a comissão quando o pagamento for aprovado.
 */

const CHAVE = "bn-afiliado";
const VALIDADE_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

/** lê ?af= da URL atual e guarda (chamar uma vez ao carregar a página) */
export function capturarAfiliado(): void {
  try {
    const codigo = new URLSearchParams(window.location.search).get("af");
    if (!codigo) return;
    localStorage.setItem(
      CHAVE,
      JSON.stringify({ codigo: codigo.trim().toLowerCase(), em: Date.now() })
    );
  } catch {
    /* navegação privada sem storage — segue sem rastreio */
  }
}

/** código de afiliado válido (ainda dentro dos 30 dias), se houver */
export function obterAfiliado(): string | undefined {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return undefined;
    const { codigo, em } = JSON.parse(bruto) as { codigo?: string; em?: number };
    if (!codigo || !em || Date.now() - em > VALIDADE_MS) {
      localStorage.removeItem(CHAVE);
      return undefined;
    }
    return codigo;
  } catch {
    return undefined;
  }
}
