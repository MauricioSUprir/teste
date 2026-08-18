"use client";

import { useState } from "react";
import { copy } from "@/lib/copy";

export function NewsletterForm() {
  const [enviado, setEnviado] = useState(false);

  if (enviado) {
    return (
      <p role="status" className="mt-5 text-[0.9375rem] font-medium text-sucesso">
        {copy.home.newsletterOk}
      </p>
    );
  }

  return (
    <form
      className="mx-auto mt-5 flex max-w-md gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setEnviado(true);
      }}
    >
      <label htmlFor="newsletter-email" className="sr-only">
        E-mail
      </label>
      <input
        id="newsletter-email"
        type="email"
        required
        autoComplete="email"
        inputMode="email"
        placeholder={copy.home.newsletterPlaceholder}
        className="h-12 grow rounded-[999px] border border-linha bg-white px-5 text-[0.9375rem] outline-none focus:border-azul"
      />
      <button
        type="submit"
        className="shrink-0 rounded-[999px] bg-azul px-6 text-[0.9375rem] font-semibold text-white hover:opacity-90"
      >
        {copy.home.newsletterCta}
      </button>
    </form>
  );
}
