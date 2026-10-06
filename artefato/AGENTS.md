# Diretrizes para Agentes de IA — `artefato/`

Este é o guia único deste diretório, consolidando as instruções anteriormente divididas entre `AGENTS.md` e `AGENT.md`. Aplica-se em conjunto com o `AGENTS.md` da raiz.

## Arquitetura e contratos

### Núcleo computacional (`packages/core`)

- Mantenha o `@routing/core` isomórfico, sem estado persistente e sem dependências externas de ambiente.
- Nunca importe `window`, `document`, `better-sqlite3`, `fastify`, `react` ou `leaflet` no núcleo.
- Use objetos serializáveis e fortemente tipados como entrada e saída (`Scenario` → `Plan`).
- Exponha a API pública por `src/index.ts`, incluindo `planScenario`, `applyVisitResults` e `verifyPlan`.
- Ao mudar contratos públicos, atualize todos os consumidores no backend, frontend e bancada experimental.
- Todo plano gerado deve passar por `verifyPlan(scenario, plan)` antes de ser retornado.
- Registre visitas não realizadas como `missed`; somente `completed` atualiza a última visita da condição. Preserve o prazo das pendências.

### Melhoria local de rotas

- O algoritmo oficial intra-rota é o **1.5-opt**, implementado por `apply1Point5Opt` em `packages/core/src/improvement/one-half-opt.ts`.
- Preserve a combinação de reinserção de um nó (1-point move) e inversão de subsegmentos (2-opt).
- Mantenha a opção `enable1_5Opt` e a compatibilidade da opção legada `enable2Opt`.

### Backend (`packages/server`)

- Use Fastify em ESM (`type: "module"`), na porta 3001.
- Mantenha o SQLite (`data/routing.db`, relativo ao diretório de execução do servidor) em WAL, com `foreign_keys = ON`.
- Preserve as tabelas `scenarios`, `plans` e `visit_results`, o versionamento de cenários e as exportações CSV e GPX.
- Invoque o `@routing/core` nas rotas HTTP; não implemente otimização dentro dos handlers.
- Retorne erros HTTP padronizados com payload `{ error: string }`.

### Frontend (`packages/web`)

- Use React 18, Vite e React-Leaflet, na porta 3000.
- Renderize posto, polígonos, pacientes e rotas por equipe; mantenha as cores das equipes estáveis entre dias.
- Preserve o fallback de planejamento local em memória via `@routing/core` quando o backend estiver indisponível.

## Convenções e tratamento de erros

- Use `kebab-case.ts` para algoritmos e utilitários; `PascalCase.tsx` para componentes React.
- Use `camelCase` para funções e variáveis e `PascalCase` para tipos e interfaces.
- Lance exceções explícitas com a causa do problema no núcleo. Nunca engula exceções ou mascare falhas de roteamento com retornos padrão.

## Verificação obrigatória de mudanças

Ao modificar qualquer arquivo em `artefato/`, compile núcleo e backend e execute o build do frontend. Os comandos abaixo partem da raiz do repositório e usam os scripts dos pacotes:

```bash
npm run build --prefix artefato/packages/core
npm run build --prefix artefato/packages/server
npm run build --prefix artefato/packages/web
```

O comando `npm run build` na raiz executa os três builds. Não ignore erros ou avisos: examine e relate qualquer limitação encontrada.

Para conferir o pipeline de ponta a ponta do núcleo após a compilação:

```bash
node artefato/packages/core/dist/example.js
```

Esse exemplo executa as três estratégias. Confira a saída, pois o script captura e imprime erros sem necessariamente terminar com código de saída diferente de zero.
