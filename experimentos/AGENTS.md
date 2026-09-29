# Diretrizes para Agentes de IA — Módulo `experimentos/`

Documento otimizado para leitura rápida de LLMs (Cursor, Copilot, Claude, ChatGPT, Antigravity).

---

## 🎯 Princípios de Rigor Experimental

* **Reprodutibilidade por Semente (Seed):**
  * Toda geração sintética DEVE usar o PRNG `mulberry32(seed)`.
  * NÃO altere as sementes dos cenários de benchmark existentes (`cenario_folgado`: 42, `cenario_equilibrado`: 123, `cenario_escasso`: 999).

* **Isonomia na Comparação de Algoritmos:**
  * A comparação em lote DEVE submeter todos os métodos (`main-heuristic`, `urgency-baseline`, `nearest-baseline`) exatamente às mesmas instâncias, calendários e matrizes de custo Haversine.

* **Formatos de Saída de Dados:**
  * Os resultados da simulação em lote DEVEM ser exportados simultaneamente para `resultados/benchmark_results.csv` e `resultados/benchmark_results.json`.
  * O relatório visual interativo em HTML DEVE ser gerado via `analise/generate_html_charts.js`.

---

## ⚡ Métricas Medidas Obrigatoriamente

1. **Atraso Acumulado Total (Dias)**
2. **Deslocamento Total Percorrido (KM)**
3. **Tempo Total de Viagem (Minutos)**
4. **Cobertura de Visitas Atendidas (%)**
5. **Utilização Média da Jornada (%)**
6. **Tempo Computacional de Execução (MS)**

---

## 🛠️ Comandos de Verificação Rápidos

```bash
# Rodar geração sintética + simulação em lote + relatório HTML
npm run experiments

# Rodar scripts individualmente
npm run generate --prefix experimentos
npm run simulate --prefix experimentos
npm run simulate-dynamic --prefix experimentos
node experimentos/analise/generate_html_charts.js
```
