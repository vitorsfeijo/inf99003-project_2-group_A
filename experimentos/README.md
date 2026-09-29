# Bancada de Experimentos e Avaliação — Pesquisa INF99003

Este diretório contém os scripts de **geração de dados sintéticos, simulação em lote e análise de resultados** utilizados para responder às perguntas de pesquisa do projeto (Ciclo 2 - INF99003).

---

## 📂 Estrutura de Módulos

```text
experimentos/
├── package.json
├── tsconfig.json
├── src/            # Código-fonte TypeScript da bancada experimental
├── cenarios/       # Arquivos JSON dos cenários gerados (folgado, equilibrado, escasso)
├── resultados/     # Datasets de saída da simulação em CSV e JSON
└── analise/        # Relatórios e gráficos comparativos
```

---

## 🔬 Protocolo Experimental e Reprodutibilidade

1. **Preparação Sintética:**
   * Utiliza o algoritmo *Mulberry32* com semente determinística.
   * Cria instâncias controladas variando o número de pacientes ($n$), número de equipes ($m$), janela móvel ($N$) e taxa de visitas vencidas.
   * Garante que cenários sejam 100% reproduzíveis.

2. **Execução em Lote:**
   * Submete exatamente o mesmo cenário e calendário a todas as estratégias comparadas:
     - `main-heuristic` (Heurística Principal + 1.5-opt)
     - `urgency-baseline` (Baseline por Urgência)
     - `nearest-baseline` (Baseline por Vizinho Mais Próximo)
   * Mede de forma isolada:
     - **Atraso Acumulado** (dias totais de atraso ao longo do horizonte)
     - **Deslocamento Total** (km)
     - **Tempo de Viagem** (minutos)
     - **Utilização e Desequilíbrio de Carga**
     - **Tempo Computacional de Execução** (ms)

3. **Relatórios e Visualização de Dados (`analise/`):**
   * Produz o arquivo interativo [experimentos/analise/relatorio_experimentos.html](file:///c:/Users/vitor/Documents/uni/pci/inf99003-project_2-group_A/experimentos/analise/relatorio_experimentos.html) alimentado com *Chart.js*.
   * Exporta datasets brutos em CSV ([experimentos/resultados/benchmark_results.csv](file:///c:/Users/vitor/Documents/uni/pci/inf99003-project_2-group_A/experimentos/resultados/benchmark_results.csv)) para análise estatística externa.

---

## 🚀 Como Executar os Experimentos

Para rodar a geração de dados e a simulação em lote:

```bash
# Na raiz do repositório
npm run experiments

# Ou dentro da pasta experimentos
cd experimentos
npm run generate
npm run simulate
node analise/generate_html_charts.js
```
