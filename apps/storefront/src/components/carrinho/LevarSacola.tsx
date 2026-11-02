"use client";

/**
 * /levar — a sacola montada no Beauty Shopping entra na sacola deste site e
 * a pessoa segue direto para o pagamento (o mesmo checkout de sempre: Pix,
 * cartão, frete, cupom e pedido no Bling).
 *
 * Preço e estoque vêm do catálogo deste site; do link só se usa o produto e
 * a quantidade (lib/carrinho/levar.ts).
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { copy } from "@/lib/copy";
import { useCarrinho } from "@/lib/carrinho/contexto";
import { aplicarAjustesProduto } from "@/lib/catalogo/ajustes";
import { obterProduto } from "@/lib/catalogo/consultas";
import { lerItensLevar } from "@/lib/carrinho/levar";
import { CartaoVidro, EscudoVidro, PalcoVidro } from "@/components/efeitos/Vidro";

const t = copy.levar;
/** tempo para ler o aviso de produto que ficou de fora antes de seguir */
const ESPERA_AVISO_MS = 3500;

export function LevarSacola() {
  const params = useSearchParams();
  const router = useRouter();
  const carrinho = useCarrinho();
  const feito = useRef(false);
  const [fora, setFora] = useState(0);
  const [nenhum, setNenhum] = useState(false);
  const [seguir, setSeguir] = useState(false);

  useEffect(() => {
    // espera a sacola salva neste navegador ser lida, senão ela apagaria o que chegou
    if (!carrinho.pronto || feito.current) return;
    feito.current = true;
    const pedidos = lerItensLevar(params.get("itens"));
    let levados = 0;
    for (const { slug, quantidade } of pedidos) {
      const base = obterProduto(slug);
      const produto = base ? aplicarAjustesProduto(base) : null;
      const variante = produto?.variantes.find((v) => v.estoque > 0);
      if (!produto || !variante) continue;
      carrinho.levar(produto.slug, variante.sku, Math.min(quantidade, variante.estoque));
      levados += 1;
    }
    const ficaram = pedidos.length - levados;
    if (!levados) {
      setNenhum(true);
      return;
    }
    setFora(ficaram);
    setSeguir(true);
  }, [carrinho, params]);

  // segue para o pagamento (efeito separado: a sacola muda logo acima e não pode cancelar a ida)
  useEffect(() => {
    if (!seguir) return;
    const tempo = setTimeout(() => router.replace("/checkout"), fora ? ESPERA_AVISO_MS : 600);
    return () => clearTimeout(tempo);
  }, [seguir, fora, router]);

  return (
    <div className="container-bn py-12">
      <PalcoVidro className="mx-auto max-w-xl rounded-[16px] p-3 sm:p-5">
        <CartaoVidro className="px-6 pb-7 pt-8 text-center">
          <EscudoVidro estado={nenhum ? "aguardando" : "ok"} />
          <h1 className="font-titulo mt-5 text-[1.5rem] font-semibold text-tinta">
            {nenhum ? t.nenhumTitulo : t.titulo}
          </h1>
          <p role="status" className="mx-auto mt-2 max-w-[40ch] text-[0.9375rem] text-grafite">
            {nenhum ? t.nenhumTexto : t.texto}
          </p>
          {fora > 0 && !nenhum && (
            <p className="vidro-aviso mx-auto mt-4 max-w-[40ch]">{t.indisponiveis(fora)}</p>
          )}
          {nenhum ? (
            <Link href="/" className="vidro-botao-marca mt-6">
              {t.verLoja}
            </Link>
          ) : (
            fora > 0 && (
              <Link href="/checkout" className="vidro-botao-marca mt-6">
                {t.irPagar}
              </Link>
            )
          )}
        </CartaoVidro>
      </PalcoVidro>
    </div>
  );
}
