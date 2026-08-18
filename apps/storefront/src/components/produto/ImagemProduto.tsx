import type { Produto } from "@/lib/catalogo/tipos";

/**
 * Placeholder de imagem de produto para a demo — SVG determinístico por produto.
 * Na operação real, substituído por fotos reais servidas do Cloudflare R2
 * via next/image (docs/02). Mantém proporção 1:1 reservada — CLS zero.
 */
export function ImagemProduto({
  produto,
  alt,
  variacao = 0,
  className = "",
}: {
  produto: Produto;
  alt: string;
  /** índice da "foto" — gera pequenas variações para galeria e hover */
  variacao?: number;
  className?: string;
}) {
  const { corA, corB, forma } = produto.visual;
  const id = `${produto.slug}-${variacao}`;
  const rotacao = variacao === 0 ? 0 : variacao % 2 === 0 ? -8 : 8;

  return (
    <svg
      viewBox="0 0 400 400"
      role="img"
      aria-label={alt}
      className={className}
      style={{ aspectRatio: "1 / 1", display: "block", width: "100%", height: "auto" }}
    >
      <defs>
        <linearGradient id={`fundo-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={corB} stopOpacity="0.35" />
          <stop offset="100%" stopColor={corB} stopOpacity="0.12" />
        </linearGradient>
        <linearGradient id={`corpo-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={corA} />
          <stop offset="100%" stopColor={corB} />
        </linearGradient>
      </defs>
      <rect width="400" height="400" fill="#FFFFFF" />
      <circle cx="200" cy="210" r="150" fill={`url(#fundo-${id})`} />
      <g transform={`rotate(${rotacao} 200 220)`}>
        {forma === "frasco" && (
          <g>
            <rect x="150" y="120" width="100" height="190" rx="18" fill={`url(#corpo-${id})`} />
            <rect x="172" y="82" width="56" height="46" rx="8" fill={corA} />
            <rect x="166" y="170" width="68" height="80" rx="6" fill="#FFFFFF" opacity="0.92" />
          </g>
        )}
        {forma === "pote" && (
          <g>
            <rect x="130" y="180" width="140" height="120" rx="22" fill={`url(#corpo-${id})`} />
            <rect x="124" y="146" width="152" height="44" rx="14" fill={corA} />
            <rect x="150" y="212" width="100" height="56" rx="6" fill="#FFFFFF" opacity="0.92" />
          </g>
        )}
        {forma === "tubo" && (
          <g>
            <path d={`M160 300 L240 300 L232 140 L168 140 Z`} fill={`url(#corpo-${id})`} />
            <rect x="176" y="104" width="48" height="38" rx="6" fill={corA} />
            <rect x="172" y="190" width="56" height="66" rx="6" fill="#FFFFFF" opacity="0.92" />
          </g>
        )}
        {forma === "spray" && (
          <g>
            <rect x="158" y="140" width="84" height="170" rx="16" fill={`url(#corpo-${id})`} />
            <rect x="176" y="96" width="48" height="30" rx="6" fill={corA} />
            <rect x="176" y="76" width="26" height="22" rx="4" fill={corA} />
            <rect x="170" y="182" width="60" height="70" rx="6" fill="#FFFFFF" opacity="0.92" />
          </g>
        )}
        {forma === "ampola" && (
          <g>
            <path d="M200 96 C226 140 244 176 244 226 a44 44 0 0 1 -88 0 C156 176 174 140 200 96 Z" fill={`url(#corpo-${id})`} />
            <circle cx="200" cy="226" r="26" fill="#FFFFFF" opacity="0.92" />
          </g>
        )}
      </g>
      {/* gota BeautyNow — elemento gráfico recorrente da marca (docs/03 §2) */}
      <path
        d="M348 336 c6 10 10 17 10 24 a10 10 0 0 1 -20 0 c0 -7 4 -14 10 -24 Z"
        fill={corA}
        opacity="0.5"
      />
    </svg>
  );
}
