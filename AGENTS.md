# Guia de Orientação para Agentes de Inteligência Artificial (`AGENTS.md`)

Este documento serve como a especificação de engenharia primária para guiar assistentes de IA (Cursor, Copilot, Claude, ChatGPT, Antigravity) no desenvolvimento, refatoração e manutenção deste repositório.

---

## 1. Visão Geral e Propósito

* **O que o projeto faz:** Provê um framework computacional reutilizável em TypeScript e uma bancada de experimentos reproduzíveis para o planejamento e replanejamento de rotas de visitas domiciliares de equipes multiprofissionais na Atenção Primária à Saúde (APS), operando sobre uma janela móvel de $N$ dias úteis com antecipação máxima $A$.
* **Problema de negócio e público-alvo:** Auxilia equipes de saúde da APS (compostas por médicos, enfermeiros e assistentes sociais) a equacionar a priorização clínica e temporal de atendimentos domiciliares, minimizar o tempo e a distância de deslocamento e adaptar-se dinamicamente a falhas ou ausências reais de pacientes através de replanejamento automático. Atua também como artefato acadêmico reproduzível da disciplina INF99003.

---

## 2. Visão Geral da Arquitetura & Tech Stack

* **Linguagens e Runtime:** TypeScript 5.4+ executando sob Node.js 20+ (módulos em formato ESM / `NodeNext`).
* **Frontend (`packages/web`):** React 18, Vite 5, Leaflet 1.9 (`react-leaflet`), Lucide React.
* **Backend & Persistência (`packages/server`):** Node.js, Fastify 4 (`@fastify/cors`), SQLite 3 manipulado via `better-sqlite3` com WAL mode e Foreign Keys ativas.
* **Núcleo de Otimização (`packages/core`):** Isomórfico, sem estado e sem dependências externas.
* **Experimentos (`experimentos/`):** PRNG determinístico Mulberry32 com semente e relatórios estatísticos em HTML/Chart.js.
* **Padrão Arquitetural:** Monorepo Modular Decoplado com Padrão Strategy para substituição de heurísticas de roteamento.

```text
               +-------------------------------------------------+
               | Interface Web (React + Vite + Mapa Leaflet)     |
               | Porta 3000                                      |
               +-----------------------+-------------------------+
                                       | HTTP / REST API
                                       v
               +-------------------------------------------------+
               | Servidor Backend (Node.js + Fastify)            |
               | Porta 3001                                      |
               +-----------+-------------------------+-----------+
                           |                         |
                           v                         v
       +-------------------+-------+   +-------------+-------------------+
       | Persistência SQLite       |   | Núcleo Computacional            |
       | (data/routing.db)         |   | (@routing/core)                 |
       | - Scenarios & Versões     |   | - Validação & Território        |
       | - Planos & Métricas       |   | - Matriz Haversine & Demanda    |
       | - Histórico de Atendimento|   | - Heurística Custo Inc + 1.5-opt|
       +---------------------------+   | - Verificador Formal           |
                                       +---------------------------------+
```

---

## 3. Estrutura de Diretórios

```text
inf99003-project_2-group_A/
├── package.json                      # Workspaces e scripts raiz (npm start, npm run experiments)
├── run-artefact.js                   # Script utilitário para orquestração simultânea dos serviços
├── AGENTS.md                         # Guia global para assistentes de IA (este arquivo)
│
├── artefato/                         # [CÓDIGO-FONTE DA APLICAÇÃO MONOREPO]
│   ├── AGENTS.md                     # Diretrizes específicas para desenvolvimento do artefato
│   ├── README.md                     # Documentação técnica do software
│   └── packages/
│       ├── core/                     # Módulo puro de otimização e heurísticas TypeScript
│       ├── server/                   # Backend Fastify, banco SQLite e exportadores CSV/GPX
│       └── web/                      # Interface gráfica React + Vite + Mapa Leaflet
│
├── experimentos/                     # [BANCADA DE EXPERIMENTAÇÃO DA PESQUISA]
│   ├── AGENTS.md                     # Regras de rigor experimental e reprodutibilidade
│   ├── README.md                     # Documentação do protocolo de testes
│   ├── src/                          # Código-fonte TypeScript da bancada experimental
│   ├── cenarios/                     # Datasets de cenários sintéticos (JSON)
│   ├── resultados/                   # Dados brutos das simulações (CSV/JSON)
│   └── analise/                      # Relatório interativo em HTML com gráficos (Chart.js)
│
├── papers/                           # Revisão bibliográfica e fichamentos de artigos de APS/VRP
├── projeto_de_pesquisa/              # Redação acadêmica do projeto de pesquisa
├── slides/                           # Apresentações das entregas das semanas
└── lab_notebook.md                   # Diário de bordo das decisões do grupo
```

---

## 4. Convenções do Código & Guia de Estilo

### Convenções de Nomenclatura
* **Arquivos e Pastas:** Use `kebab-case` para módulos e utilitários (ex: `one-half-opt.ts`, `baseline-urgency.ts`). Use `PascalCase` apenas para componentes React (ex: `MapView.tsx`, `Header.tsx`).
* **Funções e Variáveis:** Use `camelCase` (ex: `planScenario`, `calculateHaversineDistanceKm`).
* **Interfaces e Types:** Use `PascalCase` (ex: `Scenario`, `VisitCandidate`, `PlanMetrics`).

### Gerenciamento de Estado e Erros
* **Núcleo (`@routing/core`):** Funções puras que lançam objetos `Error` com mensagens amigáveis contendo a causa raiz.
* **Backend (`@routing/server`):** Retornos HTTP padronizados (`400 Bad Request`, `404 Not Found`, `500 Internal Error`) com payload JSON no formato `{ error: string }`.

### Regras Invioláveis (O que FAZER e O que NUNCA FAZER)

#### ✅ O QUE FAZER:
1. **Manter o `@routing/core` 100% isolado:** Sem referências a `window`, `document`, `Fastify` ou `SQLite`.
2. **Utilizar o algoritmo 1.5-opt:** A melhoria local de rotas deve utilizar rigorosamente a combinação de reinserção de nó (1-point move) e inversão de sub-segmentos (2-opt).
3. **Preservar determinismo:** Toda geração sintética de experimentos deve utilizar a semente de PRNG (`mulberry32`).
4. **Verificar planos:** Todo plano gerado deve obrigatoriamente passar pela validação de `verifyPlan(scenario, plan)`.

#### ❌ O QUE NUNCA FAZER:
1. **NUNCA engolir exceções:** Não utilize blocos `try/catch` vazios ou retornos padrão `null` para mascarar falhas de roteamento.
2. **NUNCA marcar visitas como concluídas por presunção:** Quando uma visita agendada falhar ou não for realizada, ela DEVE ser registrada como `missed`, mantendo o prazo original na fila de pendências.
3. **NUNCA alterar assinaturas públicas do `@routing/core` sem atualizar os consumidores:** Atualize sempre o backend e a interface web caso os contratos de `Scenario` ou `Plan` mudem.

---

## 5. Comandos Frequentes (Cheat Sheet)

```bash
# Iniciar toda a aplicação de uma vez (Backend + Frontend)
npm start

# Compilar todos os pacotes do monorepo
npm run build

# Rodar os experimentos de pesquisa em lote
npm run experiments

# Executar pacotes individualmente
npm start --prefix artefato/packages/server   # Roda apenas o backend (Porta 3001)
npm run dev --prefix artefato/packages/web     # Roda apenas o frontend (Porta 3000)

# Compilação e validação do núcleo em TypeScript
npx -p typescript tsc --cwd artefato/packages/core
```

---

## 6. Contexto de Testes & Qualidade

* **Validação de Tipos:** Garantida pela compilação estrita do TypeScript (`npx -p typescript tsc`).
* **Teste do Pipeline Computacional:** O arquivo [artefato/packages/core/src/example.ts](file:///c:/Users/vitor/Documents/uni/pci/inf99003-project_2-group_A/artefato/packages/core/src/example.ts) atua como teste end-to-end do núcleo, podendo ser executado via `node dist/example.js`.
* **Validação de Restrições Formais:** O módulo `verifyPlan` checa restrições como tempo máximo de jornada por equipe, território, unicidade do paciente e disponibilidade diária.
