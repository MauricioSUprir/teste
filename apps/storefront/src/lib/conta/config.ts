/**
 * Configuração da conta de administrador.
 *
 * A senha NUNCA fica em texto puro: guardamos apenas o hash SHA-256.
 * Credencial de demonstração ativa — será substituída pelo hash das
 * credenciais reais que o Mauricio enviar (e, na versão com backend,
 * sai do bundle e vai para variável de ambiente do servidor).
 *
 * Demo: admin@beautynow.com.br / BeautyNow@2026
 */
export const ADMIN_EMAIL = "admin@beautynow.com.br";
export const ADMIN_SENHA_HASH =
  "b125d4c1ba904294cc93e8f7bb0ea10a462c2ba5664aa625de002028e801d604";

/** Validade do código de verificação, em minutos. */
export const CODIGO_VALIDADE_MIN = 10;
