# Diretrizes para Agentes de IA — Módulo `artefato/`

Documento otimizado para leitura rápida de LLMs (Cursor, Copilot, Claude, ChatGPT, Antigravity).

---

## 🎯 Princípios Fundamentais

* **`packages/core` (Núcleo Isomórfico):**
  * Deve ser 100% puro e sem estado em TypeScript.
  * PROIBIDO importar bibliotecas de banco (`better-sqlite3`), servidor (`fastify`) ou navegador (`react`, `leaflet`).
  * Toda a API é exposta via `src/index.ts` (`planScenario`, `applyVisitResults`, `verifyPlan`).

* **`packages/server` (Backend HTTP & Persistência):**
  * API REST em Fastify (Porta 3001).
  * Banco SQLite (`data/routing.db`) com WAL mode e `foreign_keys = ON`.
  * Tabelas: `scenarios`, `plans`, `visit_results`.
  * Fornece exportação em `CSV` e `GPX`.

* **`packages/web` (Frontend Interativo):**
  * Desenvolvido em React 18 + Vite + Leaflet (Porta 3000).
  * Renderiza Posto de Saúde, Polígonos de Atuação, Pacientes e Rotas por cor de equipe.
  * Mantém suporte a fallback local em memória caso o backend esteja indisponível.

---

## ⚡ Convenções de Código

* **Nomes de arquivo:** `kebab-case.ts` para utilitários/algoritmos (ex: `one-half-opt.ts`); `PascalCase.tsx` para componentes React (ex: `MapView.tsx`).
* **Melhoria local:** O algoritmo oficial intra-rota é o **1.5-opt** (`apply1Point5Opt`), combinando 1-point move com 2-opt.
* **Erros:** Lance exceções explícitas com diagnóstico no Core; retorne `{ error: message }` no backend.

---

## 🛠️ Comandos de Verificação Rápidos

```bash
# Compilar o núcleo
npx -p typescript tsc --cwd artefato/packages/core

# Executar o teste end-to-end do núcleo
node artefato/packages/core/dist/example.js

# Compilar o backend
npx -p typescript tsc --cwd artefato/packages/server

# Testar build do frontend React
npx vite build --cwd artefato/packages/web
```
