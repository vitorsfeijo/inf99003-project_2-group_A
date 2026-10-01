# Artefato Computacional — Framework de Roteamento de Visitas Domiciliares

Este diretório contém o **artefato computacional em TypeScript** desenvolvido como parte do projeto de pesquisa em Atenção Primária à Saúde (APS) na disciplina INF99003.

O software é estruturado como um **Monorepo** em três pacotes isolados e independentes.

---

## 🏗️ Arquitetura do Monorepo (`packages/`)

```text
artefato/
├── package.json
├── tsconfig.json
└── packages/
    ├── core/      # Núcleo de otimização pura em TypeScript (sem banco ou navegador)
    ├── server/    # Backend Node.js, API REST Fastify e banco de dados SQLite
    └── web/       # Interface gráfica interativa React + Vite + Mapa Leaflet
```

---

## 📦 Descrição dos Pacientes e Módulos

### 1. Núcleo Computacional (`packages/core`)
* **Propósito:** Processar cenários, validar territórios, gerar demanda temporal, construir matrizes de custo Haversine, calcular rotas diárias por equipe e aplicar melhoria local **1.5-opt**.
* **Estratégias Implementadas:**
  1. `main-heuristic`: Heurística com prazo futuro, custo incremental de inserção $c_{inc} = d(a,i) + d(i,b) - d(a,b)$, limite de antecipação $A$ e melhoria local **1.5-opt**.
  2. `urgency-baseline`: Baseline cronológico por urgência/vencimento.
  3. `nearest-baseline`: Baseline geográfico por vizinho viável mais próximo.
* **API Principal:**
  ```typescript
  planScenario(scenario: Scenario, options: PlanOptions): Plan
  applyVisitResults(state: ScenarioState, results: VisitResult[]): ScenarioState
  verifyPlan(scenario: Scenario, plan: Plan): VerificationResult
  ```

### 2. Servidor Backend (`packages/server`)
* **Propósito:** Persistência de cenários e versões no SQLite local, execução do núcleo via HTTP e exportação de rotas.
* **Banco de Dados SQLite (`data/routing.db`):** Tabelas `scenarios`, `plans` e `visit_results`.
* **Exportação:**
  * **CSV:** Tabela estruturada contendo ordem, paciente/posto, horários estimados, tempo de deslocamento e coordenadas.
  * **GPX:** Arquivo XML com waypoints navegáveis para aplicativos de mapa offline (OsmAnd, Google Maps).

### 3. Interface Web (`packages/web`)
* **Propósito:** Aplicação interativa em React + Leaflet.
* **Recursos:**
  * Mapa interativo com OpenStreetMap exibindo Posto de Saúde, Polígonos de Território, Pacientes e Rotas Coloridas por Equipe.
  * Importação de arquivos JSON e seleção de cenários de exemplo.
  * Painel de controle para trocar métodos de roteamento e visualizar métricas.
  * Formulário de registro de execução real para acionar o **replanejamento automático**.

---

## 🚀 Como Compilar e Executar

Para rodar todo o artefato de uma só vez a partir da raiz do repositório:

```bash
npm start
```

Para rodar os pacotes individualmente:

```bash
# Servidor Backend (Porta 3001)
npm start --prefix artefato/packages/server

# Interface Web (Porta 3000)
npm run dev --prefix artefato/packages/web
```
