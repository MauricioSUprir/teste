import Script from "next/script";

/**
 * Google Analytics 4. O identificador de medição entra por variável de
 * ambiente no build de cada loja (NEXT_PUBLIC_GA_ID=G-XXXXXXX) — sem ele,
 * nada é carregado, então o site não fica pedindo um script que não existe.
 *
 * `anonymize_ip` liga a anonimização do IP, como pede a nossa política de
 * privacidade.
 */
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export function Analytics() {
  if (!GA_ID) return null;
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}', { anonymize_ip: true });`}
      </Script>
    </>
  );
}
