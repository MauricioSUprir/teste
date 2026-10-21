/**
 * Configuração da conta de administrador.
 *
 * A senha NUNCA fica em texto puro nem em hash simples: guardamos o
 * derivado PBKDF2-SHA256 com 310.000 iterações e salt — o padrão OWASP
 * para armazenamento de senha, que torna ataques de força bruta
 * impraticáveis na prática.
 *
 * O login do admin exige sempre a verificação em 2 etapas (código de
 * 6 dígitos). Na demo o código aparece na tela; com o backend ele passa
 * a ser enviado por e-mail — e esta credencial sai do bundle público
 * para variável de ambiente do servidor.
 */
export const ADMIN_EMAIL = "lojabeautynow@gmail.com";
export const ADMIN_SENHA_PBKDF2 =
  "e5965f5ed7c821dbe195f1dc7d376fea9a8a4eee0579360b9f9eb5463a142e8a";
export const ADMIN_SALT = "beautynow-admin-v1";
export const ADMIN_PBKDF2_ITERACOES = 310000;

/**
 * Outras pessoas com acesso ao painel (pedido do Mauricio, 21/10). Entram SÓ
 * com o código de 6 dígitos que chega no próprio e-mail — não existe senha
 * delas guardada no site. O e-mail fica como hash SHA-256 (em minúsculas)
 * para o endereço não aparecer no código público. Para tirar o acesso de
 * alguém, apague a linha e publique.
 */
export const ADMINS_POR_CODIGO: Readonly<Record<string, string>> = {
  // Fabiana (fabiana@gruposuprir.com)
  "45e590fc9272ca2a68b2a266e38590a7b389ef2af62051dc8cdee52caee53698": "Fabiana",
};

/** Validade do código de verificação, em minutos. */
export const CODIGO_VALIDADE_MIN = 10;

/**
 * Client ID do Google Identity Services (público por natureza — aparece no
 * front-end de qualquer site que usa "Entrar com o Google").
 * Vazio = botão em modo demonstração. Para ativar o botão oficial do Google:
 * console.cloud.google.com → APIs e serviços → Credenciais → Criar credencial
 * → ID do cliente OAuth → Aplicativo da Web, com a origem
 * https://mauriciosuprir.github.io — e me envie o ID gerado.
 */
export const GOOGLE_CLIENT_ID =
  "500782475320-59aarsugep172asaohrvvvqpec0hpluj.apps.googleusercontent.com";
