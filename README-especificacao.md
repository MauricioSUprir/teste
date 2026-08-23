# BeautyNow — E-commerce de Cosméticos

Pacote de especificação completo para o **Claude Code** construir o e-commerce próprio da BeautyNow, usando a **Beleza na Web (BLZ)** como benchmark de referência de UX, arquitetura de informação e merchandising.

---

## Como usar este pacote

1. Crie um repositório vazio (ex.: `beautynow-store`) e copie **toda** esta pasta para a raiz dele.
2. Abra o Claude Code na raiz do repositório.
3. Cole o conteúdo de `prompts/00-kickoff-claude-code.md` como primeira mensagem.
4. O Claude Code vai ler o `CLAUDE.md` automaticamente e seguir a ordem: **pesquisa → plano → ADRs → scaffold → sprints**.

> **Não pule a Fase 0 (pesquisa da BLZ).** Todo o resto do projeto depende dela. O documento `docs/01-benchmark-belezanaweb.md` traz o protocolo exato de pesquisa, o que capturar e onde registrar.

---

## Estrutura

```
beautynow-store/
├── CLAUDE.md                          # Contexto permanente do projeto (lido pelo Claude Code)
├── README.md                          # Este arquivo
├── docs/
│   ├── 00-PRD.md                      # Visão, escopo, personas, requisitos funcionais
│   ├── 01-benchmark-belezanaweb.md    # Protocolo de pesquisa da BLZ + regras de originalidade
│   ├── 02-arquitetura.md              # Stack, infra, ADRs, ambientes
│   ├── 03-design-system.md            # Identidade visual, tokens, componentes
│   ├── 04-modelo-de-dados.md          # Entidades, catálogo, atributos de beleza
│   ├── 05-integracoes.md              # Bling, Mercado Pago, Melhor Envio, n8n, Larissa
│   ├── 06-roadmap-sprints.md          # 8 sprints, épicos, tickets, critérios de aceite
│   ├── 07-seo-conteudo-performance.md # SEO técnico, conteúdo, Core Web Vitals
│   ├── 08-juridico-fiscal-lgpd.md     # CDC, Decreto 7.962, LGPD, ANVISA, fiscal
│   └── 09-qa-testes-dod.md            # Estratégia de testes, Definition of Done
├── prompts/
│   ├── 00-kickoff-claude-code.md      # Prompt inicial (cole no Claude Code)
│   └── 01-prompts-por-sprint.md       # Prompt de abertura de cada sprint
└── .claude/
    └── commands/                      # Slash commands do projeto
        ├── benchmark.md
        ├── sprint.md
        └── revisar-pdp.md
```

---

## Princípio inegociável

A Beleza na Web é **referência de padrão de qualidade**, não modelo de cópia. Nada de código, HTML/CSS, imagens, textos, descrições de produto, fotos ou identidade visual da BLZ entra neste projeto. O que se extrai é o **aprendizado de UX**: quais informações aparecem, em que ordem, que decisão do cliente cada bloco resolve. A implementação é 100% original, com a identidade da BeautyNow. Regras completas em `docs/01-benchmark-belezanaweb.md`.
