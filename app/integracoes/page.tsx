import { db } from "@/lib/db";
import { googleConfigurado } from "@/lib/google";
import { PainelGoogle } from "@/components/PainelGoogle";

export const dynamic = "force-dynamic";

export default async function Integracoes() {
  const conta = await db.googleAccount.findUnique({ where: { id: 1 } });

  return (
    <>
      <h1>Integrações</h1>
      <p className="subtitulo">
        Conecte sua conta Google para importar atividades do Classroom como tarefas, ver
        e-mails de estudo do Gmail e acessar materiais do Drive — tudo somente leitura.
      </p>
      <PainelGoogle
        configurado={googleConfigurado()}
        contaEmail={conta?.email ?? null}
      />
    </>
  );
}
