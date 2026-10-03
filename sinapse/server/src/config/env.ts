import { z } from 'zod';

/**
 * Configuração central. Toda variável sensível vem do ambiente e é validada na
 * inicialização: a aplicação não sobe com configuração inválida.
 */
const bool = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(8790),
  HOST: z.string().default('0.0.0.0'),
  /** Origem pública da aplicação (usada em CSRF, cookies e callbacks OAuth). */
  APP_ORIGIN: z.string().url().default('http://localhost:5180'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatório'),
  DATABASE_POOL_MAX: z.coerce.number().int().default(10),

  /** Segredo usado para assinar estados OAuth e derivar chaves. Mínimo 32 caracteres. */
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET precisa de pelo menos 32 caracteres'),
  /** Chave AES-256 (base64, 32 bytes) para cifrar tokens de integrações em repouso. */
  ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, 'base64').length === 32, 'ENCRYPTION_KEY deve ser 32 bytes em base64'),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  ALLOW_REGISTRATION: bool.default(true),

  // IA
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_BASE_URL: z.string().url().optional(),
  /** Ativa o fallback server-side da Anthropic em recusas de segurança (beta). */
  ANTHROPIC_SERVER_FALLBACK: bool.default(true),
  OPENAI_COMPAT_API_KEY: z.string().optional(),
  OPENAI_COMPAT_BASE_URL: z.string().url().optional(),
  /** Lista separada por vírgula de modelos do provedor compatível com OpenAI. */
  OPENAI_COMPAT_MODELS: z.string().optional(),
  AI_DEFAULT_MODEL: z.string().optional(),
  /** Modelos de fallback (vírgula), tentados em erros transitórios antes do primeiro token. */
  AI_FALLBACK_MODELS: z.string().optional(),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().default(120_000),
  /** Simulador local determinístico. Somente para desenvolvimento e testes automatizados. */
  AI_ENABLE_SIMULATOR: bool.default(false),

  // Agente
  AGENT_MAX_STEPS: z.coerce.number().int().min(1).max(50).default(12),
  AGENT_RUN_TIMEOUT_MS: z.coerce.number().int().default(10 * 60_000),
  AGENT_APPROVAL_TIMEOUT_MS: z.coerce.number().int().default(15 * 60_000),

  // Arquivos
  STORAGE_DIR: z.string().default('./data/uploads'),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(25),

  // Pesquisa na web (opcional)
  SEARCH_PROVIDER: z.enum(['tavily', 'brave', '']).optional(),
  SEARCH_API_KEY: z.string().optional(),

  // OAuth (opcionais: cada integração só fica disponível se configurada)
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // E-mail (recuperação de conta)
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default('Sinapse <no-reply@localhost>'),

  // Observabilidade
  METRICS_TOKEN: z.string().optional(),
  /** Libera requisições de ferramentas a hosts privados (somente desenvolvimento/testes). */
  ALLOW_PRIVATE_NETWORK_FETCH: bool.default(false),
  TRUST_PROXY: bool.default(false),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuração inválida:\n${issues}\nVeja .env.example.`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === 'production' && env.AI_ENABLE_SIMULATOR) {
    throw new Error('AI_ENABLE_SIMULATOR não pode ser usado em produção.');
  }
  if (env.NODE_ENV === 'production' && env.ALLOW_PRIVATE_NETWORK_FETCH) {
    throw new Error('ALLOW_PRIVATE_NETWORK_FETCH não pode ser usado em produção.');
  }
  return env;
}

export const isSecureOrigin = (env: Env) => env.APP_ORIGIN.startsWith('https://');
