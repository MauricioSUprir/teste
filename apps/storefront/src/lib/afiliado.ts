/**
 * Rastreio de afiliado no BeautyNow — o profissional da Be2Beauty divulga
 * https://www.beautynowstore.com.br/?af=codigo; o código fica guardado no
 * navegador do cliente por 30 dias e segue junto com o pedido, para o
 * servidor creditar a comissão quando o pagamento for aprovado.
 */

const CHAVE = "bn-afiliado";
const VALIDADE_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

interface RastreioAfiliado {
  codigo?: string;
  /** usuário de vendedor do afiliado (buscado no servidor após capturar o link) */
  usuario?: string;
  em?: number;
}

/**
 * Lê ?af= da URL atual e guarda. Devolve o código quando a visita VEIO de um
 * link de afiliado agora (para a notificação "você entrou pelo link de…").
 */
export function capturarAfiliado(): string | undefined {
  try {
    const codigo = new URLSearchParams(window.location.search).get("af");
    if (!codigo) return undefined;
    const limpo = codigo.trim().toLowerCase();
    localStorage.setItem(CHAVE, JSON.stringify({ codigo: limpo, em: Date.now() }));
    return limpo;
  } catch {
    /* navegação privada sem storage — segue sem rastreio */
    return undefined;
  }
}

function lerRastreio(): RastreioAfiliado | undefined {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return undefined;
    const r = JSON.parse(bruto) as RastreioAfiliado;
    if (!r.codigo || !r.em || Date.now() - r.em > VALIDADE_MS) {
      localStorage.removeItem(CHAVE);
      return undefined;
    }
    return r;
  } catch {
    return undefined;
  }
}

/** código de afiliado válido (ainda dentro dos 30 dias), se houver */
export function obterAfiliado(): string | undefined {
  return lerRastreio()?.codigo;
}

/** usuário do vendedor do link capturado (pré-preenche o campo no pagamento) */
export function obterVendedorUsuario(): string | undefined {
  return lerRastreio()?.usuario;
}

/** guarda o usuário do vendedor descoberto no servidor para o código atual */
export function guardarVendedorUsuario(usuario: string): void {
  try {
    const r = lerRastreio();
    if (!r) return;
    localStorage.setItem(CHAVE, JSON.stringify({ ...r, usuario }));
  } catch {
    /* sem storage */
  }
}
