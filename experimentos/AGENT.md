# Instruções para Agentes I.A. — Diretório `experimentos/`

Este arquivo estabelece os princípios de **rigor científico e controle experimental** que qualquer agente I.A. deve seguir ao trabalhar na pasta `experimentos/`.

---

## 🎯 Regras de Integridade Experimental

1. **Reprodutibilidade Estrita por Semente (Seed):**
   * NUNCA altere as sementes aleatórias dos cenários existentes (`cenario_folgado`, `cenario_equilibrado`, `cenario_escasso`) sem documentar explicitamente a razão.
   * Novos cenários sintéticos DEVEM obrigatoriamente utilizar a função PRNG determinística `mulberry32(seed)`.

2. **Isonomia na Comparação de Métodos:**
   * Todos os métodos (`main-heuristic`, `urgency-baseline`, `nearest-baseline`) DEVEM ser executados sobre as **mesmas entradas exatas**: mesma matriz de custos Haversine, mesmo número de equipes, mesma jornada máxima e mesmo calendário.

3. **Validade das Métricas Simuladas:**
   * Separe sempre as métricas do **plano previsto** dos resultados **efetivamente simulados** após falhas ou ausências de pacientes.
   * Não omita cenários em que o algoritmo não atinja 100% de cobertura; falhas de capacidade devem ser registradas com clareza na fila de não alocados.

---

## 🧪 Verificação Obrigatória

Ao modificar o pipeline experimental:
1. Re-execute a compilação e a simulação:
   ```bash
   npx -p typescript tsc --cwd experimentos
   npm run generate --prefix experimentos
   npm run simulate --prefix experimentos
   npm run simulate-dynamic --prefix experimentos
   ```
2. Verifique se os arquivos `benchmark_results.json` e `benchmark_results.csv` foram gerados corretamente sem valores nulos ou vazios (`NaN`).
