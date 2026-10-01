# Instruções para Agentes I.A. — Diretório `artefato/`

Este arquivo estabelece as regras de arquitetura, contrato e padrões de código que qualquer agente I.A. deve seguir rigorosamente ao trabalhar no diretório `artefato/`.

---

## 📐 Diretrizes de Arquitetura

1. **Pureza do `@routing/core` (`packages/core`):**
   * O código em `packages/core` deve ser **estritamente isomórfico e puro em TypeScript**.
   * **NUNCA** adicione dependências de ambiente como `window`, `document`, `better-sqlite3`, `fastify` ou `leaflet` no pacote `@routing/core`.
   * Toda a comunicação de entrada e saída é feita via objetos JSON fortemente tipados (`Scenario` -> `Plan`).

2. **Algoritmo de Melhoria Local (1.5-Opt):**
   * O algoritmo de melhoria intra-rota padronizado é o **1.5-opt** (`src/improvement/one-half-opt.ts`), que combina a reinserção de nós isolados (1-point move) com a inversão de sub-segmentos (2-opt).
   * Mantenha o suporte à flag `enable1_5Opt` nas opções de planejamento.

3. **Backend (`packages/server`):**
   * O servidor utiliza **Fastify** em formato ESM (`type: "module"`).
   * O banco de dados **SQLite** deve sempre rodar em modo WAL (`journal_mode = WAL`) com chaves estrangeiras ativas.
   * Não insira lógica de otimização de rotas diretamente nas rotas HTTP do Fastify; invoque sempre as funções do `@routing/core`.

4. **Frontend (`packages/web`):**
   * Interface desenvolvida em **React 18**, **Vite** e **React-Leaflet**.
   * Cores de equipe devem ser estáveis entre dias.
   * A interface deve tratar graciosamente o modo offline, permitindo o cálculo local via `@routing/core` caso o servidor backend esteja indisponível.

---

## 🧪 Verificação Obrigatória de Mudanças

Ao modificar qualquer arquivo dentro de `artefato/`:
1. Execute a compilação do TypeScript:
   ```bash
   npx -p typescript tsc --cwd artefato/packages/core
   npx -p typescript tsc --cwd artefato/packages/server
   ```
2. Execute o build da interface web:
   ```bash
   npx vite build --cwd artefato/packages/web
   ```
3. Garanta que nenhum aviso ou erro de compilação seja ignorado.
