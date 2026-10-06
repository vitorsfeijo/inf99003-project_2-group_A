# Diretrizes para Agentes de IA — `experimentos/`

Este é o guia único deste diretório, consolidando as instruções anteriormente divididas entre `AGENTS.md` e `AGENT.md`. Aplica-se em conjunto com o `AGENTS.md` da raiz.

## Rigor e integridade experimental

### Reprodutibilidade

- Toda geração sintética deve usar o PRNG determinístico `mulberry32(seed)`.
- Preserve as sementes dos benchmarks existentes: `cenario_folgado` = 42, `cenario_equilibrado` = 123 e `cenario_escasso` = 999.
- Não altere essas sementes como parte de manutenção rotineira. Uma revisão explícita do protocolo que exija a alteração deve documentar a razão e o impacto na comparação com resultados anteriores.

### Isonomia entre métodos

- Execute `main-heuristic`, `urgency-baseline` e `nearest-baseline` sobre as mesmas instâncias exatas.
- Preserve a mesma matriz de custos Haversine, equipes, jornada máxima e calendário para todos os métodos comparados.
- Todo plano gerado deve passar pelo verificador do núcleo.

### Métricas e resultados

- Separe as métricas do plano previsto dos resultados efetivamente simulados após falhas ou ausências.
- Não omita cenários com cobertura inferior a 100%; registre falhas de capacidade na fila de visitas não alocadas.
- Visitas não realizadas devem permanecer como `missed`, preservando seu prazo original.
- Meça obrigatoriamente atraso acumulado (dias), deslocamento total (km), tempo de viagem (minutos), cobertura (%), utilização média da jornada (%) e tempo computacional (ms).
- Exporte o benchmark em ambos os formatos: `resultados/benchmark_results.csv` e `resultados/benchmark_results.json`.
- Gere o relatório HTML interativo por `analise/generate_html_charts.js`.

## Verificação obrigatória

Ao modificar o pipeline experimental, compile e execute a geração e as simulações. Os comandos partem da raiz do repositório:

```bash
npm run build --prefix artefato/packages/core
npm run build --prefix experimentos
npm run generate --prefix experimentos
npm run simulate --prefix experimentos
npm run simulate-dynamic --prefix experimentos
node experimentos/analise/generate_html_charts.js
```

Confira a geração de `benchmark_results.json` e `benchmark_results.csv`, a consistência das métricas e a ausência de valores nulos, vazios ou `NaN`. Não ignore erros de compilação ou execução.

Para executar todas as etapas acima de uma vez:

```bash
npm run experiments:all
```

Para executar somente o benchmark ou a simulação dinâmica, com os pacotes já compilados:

```bash
npm run experiments
npm run experiments-dynamic
```

`npm run experiments` executa apenas o benchmark estático; não inclui geração de cenários nem relatório HTML.
