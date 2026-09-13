/**
 * Dados reais de cada negócio — fonte única para contato, endereço, mapa,
 * marcação de negócio local (JSON-LD) e rodapé.
 *
 * Regra: só entra aqui informação confirmada pelo Mauricio. Campo que a gente
 * ainda não tem fica `undefined` — a interface esconde o bloco em vez de
 * mostrar dado inventado (endereço errado no mapa é pior que mapa nenhum).
 */
import { LOJA_ID, type LojaId } from "@/lib/loja";

export interface Endereco {
  rua: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
}

export interface MembroEquipe {
  nome: string;
  cargo: string;
  /** arquivo em public/equipe/ — foto real, nunca banco de imagens */
  foto: string;
}

export interface Negocio {
  /** razão social / nome que aparece nos documentos e no JSON-LD */
  nomeLegal: string;
  cnpj?: string;
  email: string;
  /** só dígitos, com DDI — para o link do WhatsApp */
  whatsapp?: string;
  /** como o número aparece escrito na tela */
  whatsappVisivel?: string;
  endereco?: Endereco;
  /** cidade/estado de atuação quando não há endereço público de loja */
  regiao: string;
  horario: string;
  /** em quanto tempo a gente promete responder (item "promessa de resposta") */
  promessaResposta: string;
  instagram?: string;
  /** endereço do site publicado — usado no robots.txt e no JSON-LD */
  site: string;
  /** fotos reais do time (item de confiança). Vazio = seção não aparece:
   *  foto de banco de imagens passando por equipe é o oposto de confiança. */
  equipe?: MembroEquipe[];
}

const NEGOCIOS: Record<LojaId, Negocio> = {
  beautynow: {
    nomeLegal: "BeautyNow Cosméticos",
    cnpj: "52.286.975/0001-21",
    email: "atendimento@beautynow.com.br",
    whatsapp: "5521997322464",
    whatsappVisivel: "(21) 99732-2464",
    regiao: "Rio de Janeiro, RJ — entrega para todo o Brasil",
    horario: "Segunda a sexta, das 9h às 18h",
    promessaResposta: "Respondemos em até 1 dia útil — no WhatsApp, normalmente em minutos.",
    site: "https://www.beautynowstore.com.br",
  },
  be2beauty: {
    nomeLegal: "Be2Beauty — Distribuição profissional",
    cnpj: "52.286.975/0001-21",
    email: "atendimento@beautynow.com.br",
    whatsapp: "5521997322464",
    whatsappVisivel: "(21) 99732-2464",
    regiao: "Rio de Janeiro, RJ — atende salões e lojistas em todo o Brasil",
    horario: "Segunda a sexta, das 9h às 18h",
    promessaResposta: "Respondemos em até 1 dia útil — no WhatsApp, normalmente em minutos.",
    site: "https://www.be2beauty.com.br",
  },
  pulse: {
    nomeLegal: "Pulse Beauty Store",
    email: "atendimento@beautynow.com.br",
    whatsapp: "5521997322464",
    whatsappVisivel: "(21) 99732-2464",
    regiao: "Rio de Janeiro, RJ",
    horario: "Segunda a sexta, das 9h às 18h",
    promessaResposta: "Respondemos em até 1 dia útil — no WhatsApp, normalmente em minutos.",
    instagram: "https://www.instagram.com/pulse.beautystore/",
    site: "https://www.beautynowstore.com.br/pulse",
  },
  bradeco: {
    nomeLegal: "Bradeco Distribuidora",
    email: "admbradeco@gmail.com",
    endereco: {
      rua: "Avenida Rosa Zanetti Ferragut, 195",
      bairro: "Pinheirinho",
      cidade: "Vinhedo",
      uf: "SP",
      cep: "13289-010",
    },
    regiao: "Vinhedo, SP — atende todo o estado de São Paulo",
    horario: "Segunda a sexta, das 9h às 18h (sábado fechado)",
    promessaResposta: "Respondemos em até 1 dia útil.",
    instagram: "https://www.instagram.com/bradecodistribuidora/",
    site: "https://www.beautynowstore.com.br/bradeco",
  },
};

export const NEGOCIO: Negocio = NEGOCIOS[LOJA_ID];

/** endereço numa linha só, do jeito que se escreve num envelope */
export function enderecoEmLinha(e: Endereco): string {
  return `${e.rua} · ${e.bairro} · ${e.cidade}/${e.uf} · CEP ${e.cep}`;
}

/** busca do endereço no Google Maps (mapa embutido e botão de rota) */
export function consultaMapa(e: Endereco): string {
  return encodeURIComponent(`${e.rua}, ${e.bairro}, ${e.cidade} - ${e.uf}, ${e.cep}`);
}

export function linkWhatsapp(numero: string, mensagem?: string): string {
  const texto = mensagem ? `?text=${encodeURIComponent(mensagem)}` : "";
  return `https://wa.me/${numero}${texto}`;
}
