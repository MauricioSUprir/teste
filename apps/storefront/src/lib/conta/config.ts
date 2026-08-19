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
export const GOOGLE_CLIENT_ID = "";
