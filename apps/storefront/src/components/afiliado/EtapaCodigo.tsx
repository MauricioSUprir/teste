"use client";

/** Confirmação do código de 6 dígitos — o mesmo visual de `conta/EtapaCodigo.tsx` (CodigoVidro). */
import { useAfiliado } from "@/lib/afiliado/contexto";
import { CodigoVidro } from "@/components/conta/CodigoVidro";

export function EtapaCodigo() {
  const afiliado = useAfiliado();
  return (
    <CodigoVidro
      idCampo="codigo-afiliado"
      email={afiliado.emailAguardandoCodigo ?? ""}
      codigoDemo={afiliado.codigoDemo}
      aguardando={afiliado.aguardandoCodigo}
      confirmar={afiliado.confirmarCodigo}
      reenviar={afiliado.reenviarCodigo}
      cancelar={afiliado.cancelarVerificacao}
    />
  );
}
