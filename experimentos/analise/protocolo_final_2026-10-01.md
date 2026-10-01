# Análise do protocolo experimental final

**Execução:** 01/10/2026  
**Código:** `experimentos/src` e `artefato/packages/core`  
**Métodos:** `main-heuristic`, `urgency-baseline`, `nearest-baseline`

## Protocolo executado

Foram executadas, nesta ordem:

1. Compilação do artefato e da bancada experimental.
2. Geração dos cenários sintéticos.
3. Benchmark estático para os três métodos.
4. Simulação dinâmica com falhas e replanejamento.
5. Geração do relatório visual em HTML.

Os três métodos receberam os mesmos cenários, calendários e parâmetros. Os resultados foram conferidos quanto a valores nulos e `NaN`.

## Integridade dos resultados

| Conjunto | Registros | Resultado |
| --- | ---: | --- |
| Benchmark estático | 33 | 11 cenários x 3 métodos |
| Simulação dinâmica | 132 | 11 cenários x 3 métodos x 4 taxas de falha |
| Valores nulos ou `NaN` | 0 | Nenhum encontrado |

Arquivos gerados ou atualizados:

- `resultados/benchmark_results.json`
- `resultados/benchmark_results.csv`
- `resultados/dynamic_simulation_results.json`
- `resultados/dynamic_simulation_results.csv`
- `resultados/statistical_summary.json`
- `analise/relatorio_experimentos.html`

## Benchmark estático

Médias sobre os 11 cenários:

| Método | Cobertura | Atraso acumulado (dias) | Deslocamento (km) | Tempo (ms) |
| --- | ---: | ---: | ---: | ---: |
| Heurística 1.5-opt | 100,00% | 116,91 | 90,59 | 3,996 |
| Baseline de urgência | 99,09% | 120,64 | 103,68 | 1,079 |
| Baseline geográfico | 100,00% | 114,36 | 62,61 | 2,356 |

### Leitura

- A heurística 1.5-opt manteve cobertura média total e teve menos atraso médio que o baseline de urgência.
- O baseline geográfico apresentou o menor deslocamento médio, mas isso não implica melhor desempenho temporal.
- A heurística foi a mais lenta em média, como esperado por avaliar pontuações e inserções com mais opções.
- O benchmark não sustenta a afirmação de que a heurística domina todos os métodos: há uma troca entre atraso, cobertura, deslocamento e tempo computacional.

## Simulação dinâmica

A simulação contém quatro taxas de falha: 0%, 10%, 20% e 40%, com 11 cenários por combinação de método e taxa.

Médias agregadas nas 44 execuções de cada método:

| Método | Visitas concluídas | Visitas perdidas | Cobertura real | Atraso real (dias) | Deslocamento real (km) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Heurística 1.5-opt | 22,59 | 5,18 | 77,10% | 32,02 | 105,69 |
| Baseline de urgência | 21,68 | 5,32 | 75,56% | 33,18 | 114,69 |
| Baseline geográfico | 23,36 | 5,39 | 76,42% | 29,95 | 74,30 |

Nas medianas por taxa de falha, a heurística apresentou:

| Taxa de falha | Cobertura mediana | Atraso mediano (dias) | Deslocamento mediano (km) |
| ---: | ---: | ---: | ---: |
| 0% | 100,00% | 0 | 39,15 |
| 10% | 92,59% | 7 | 45,10 |
| 20% | 83,33% | 16 | 52,95 |
| 40% | 61,00% | 20 | 63,45 |

### Leitura

- As falhas reduzem cobertura e elevam o atraso para todos os métodos.
- A heurística teve cobertura dinâmica média ligeiramente maior que os baselines e atraso menor que o baseline de urgência.
- O baseline geográfico continuou sendo o menor em deslocamento, mas não foi o melhor em cobertura.
- O efeito das falhas não deve ser resumido apenas por uma média: os resultados variam entre cenários.

## Pareto, sensibilidade e complexidade

Esta execução fornece comparações descritivas, mas ainda não fecha três análises previstas:

- **Fronteira de Pareto:** ainda não foi calculada formalmente por cenário e método.
- **Sensibilidade:** ainda falta variar sistematicamente `N`, `A`, número de pacientes, equipes, capacidade e pesos de prioridade.
- **Complexidade empírica:** ainda falta um experimento de escala que relacione tempo e memória a `n`, `m`, `N` e ao número de replanejamentos.

Portanto, os resultados sustentam uma comparação inicial entre métodos, mas não uma conclusão geral de superioridade.

## Conclusão

O protocolo final foi executado com sucesso e produziu dados íntegros para o benchmark estático, a simulação dinâmica e o relatório HTML. Nesta amostra, a heurística 1.5-opt oferece bom compromisso entre cobertura e atraso, enquanto o baseline geográfico minimiza deslocamento. A próxima etapa metodológica é executar a análise de Pareto, sensibilidade e escala antes da redação da conclusão final.
