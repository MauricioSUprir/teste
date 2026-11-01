"use client";

/**
 * Etapa do código de verificação — compartilhada por login e cadastro.
 * Todo e-mail que entra na conta passa por aqui, sem exceção.
 * Na demo o código aparece na tela; com o servidor no ar, chega por e-mail.
 * O visual (vidro, 6 casas, reenvio e "Verificado com sucesso") fica em CodigoVidro.
 */
import { useConta } from "@/lib/conta/contexto";
import { CodigoVidro } from "./CodigoVidro";

export function EtapaCodigo({ aoConcluir }: { aoConcluir: () => void }) {
  const conta = useConta();
  return (
    <CodigoVidro
      idCampo="codigo"
      email={conta.emailAguardandoCodigo ?? ""}
      codigoDemo={conta.codigoDemo}
      aguardando={conta.aguardandoCodigo}
      confirmar={conta.confirmarCodigo}
      reenviar={conta.reenviarCodigo}
      cancelar={conta.cancelarVerificacao}
      aoConcluir={aoConcluir}
      sangrar
    />
  );
}
