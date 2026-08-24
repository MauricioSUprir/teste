import { db } from "@/lib/db";
import { pushConfigurado } from "@/lib/notificacoes";
import { PainelNotificacoes } from "@/components/PainelNotificacoes";

export const dynamic = "force-dynamic";

export default async function Notificacoes() {
  const [inscricoes, contaGoogle] = await Promise.all([
    db.pushSubscription.count(),
    db.googleAccount.findUnique({ where: { id: 1 } }),
  ]);

  return (
    <>
      <h1>Notificações</h1>
      <p className="subtitulo">
        Receba um resumo diário com o que está vencendo, provas do calendário e revisões
        pendentes — como notificação na tela (funciona no computador e no celular) e por
        e-mail no seu Gmail.
      </p>
      <PainelNotificacoes
        pushConfigurado={pushConfigurado()}
        vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
        dispositivosInscritos={inscricoes}
        emailConectado={contaGoogle?.email ?? null}
      />
    </>
  );
}
