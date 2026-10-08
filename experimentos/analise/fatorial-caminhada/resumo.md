# Resultados para apresentação — experimento fatorial

## Desenho

- **Base geográfica:** território GeoSaúde US Restinga, Porto Alegre; polígono original no nível 1× e versões escaladas de forma sintética em 0,5× e 2× a área. Área original aproximada: 16,68 km².
- **Fatores independentes:** pacientes 15/30/45/90 (contagem); área 0.5/1/2×; horizonte 5/10/22 dias úteis; demanda já vencida 0/25/50%; falha por tentativa 0/5/10%.
- **Contagem das instâncias:** 1 território base × 3 sementes × 4 quantidades de pacientes × 3 versões de área desse território × 3 horizontes × 3 proporções de demanda vencida = 324 cenários propostos. 324 tinham caminhos a pé completos.
- **Contagem das execuções:** 324 cenários × 3 estratégias = 972 planos iniciais. 972 planos × 3 probabilidades de ausência = 2916 simulações dinâmicas. Uma simulação executa todos os dias úteis do horizonte e refaz o plano a cada dia.
- **Controles:** uma equipe com 240 min/dia, início 2026-10-01, antecipação máxima 2 dias, uma visita por paciente e durações de deslocamento obtidas do OSRM com foot.lua. Perfis clínicos e prioridades seguem a amostra sintética da fonte.
- **Sorteios comuns:** a mesma semente gera os mesmos pacientes e perfis antes da alteração de área, horizonte e atraso inicial; o sorteio de falha por paciente e data é igual entre estratégias e níveis de falha, com limiares de 0%, 5% e 10%.

**Prioridade atendida a tempo (%):** some os pesos das visitas feitas a tempo. Divida pela soma dos pesos de todas as visitas da demanda inicial. Multiplique por 100. Visitas já vencidas antes da simulação contam se forem concluídas no primeiro dia. Exemplo: visitas de pesos 1, 3 e 5 somam 9 pontos; se só a de peso 5 for feita a tempo, o resultado é 5 ÷ 9 = 55,56% dos pontos de prioridade, não dos pacientes.

## Comparação pareada

Cada par compara dois métodos no mesmo cenário e com a mesma probabilidade de ausência. Há 324 cenários × 3 probabilidades de ausência = 972 pares por comparação dinâmica. Ganho positivo favorece a heurística principal: para cobertura, principal menos referência; para atraso, distância e tempo, referência menos principal. Por isso, ganho negativo de distância significa mais caminhada da heurística. Na tabela, “vitórias/empates/derrotas” conta os pares em que a heurística foi melhor, igual ou pior. Cada linha dinâmica soma 972 pares. Cada linha do plano inicial soma 324 cenários, pois o plano é calculado antes das ausências. Médias por fator usam o mesmo número de combinações dos demais fatores.

**Leitura sugerida:** nos 972 pares frente ao vizinho mais próximo, a prioridade atendida a tempo da heurística foi, em média, 9,65 pontos percentuais maior. Ela venceu em 899 pares, empatou em 64 e perdeu em 9; essas contagens somam 972. A caminhada média foi 113,16 km com a heurística e 109,83 km com o vizinho. O aumento relativo à média do vizinho foi **3,03%**: (113,16 ÷ 109,83 − 1) × 100. Em 473 pares, a heurística caminhou mais. Também gastou 107,37 milissegundos a mais, em média, somando os cálculos diários de uma execução.

| Baseline | Métrica | Ganho médio | Ganho mediano | Vitórias/empates/derrotas |
|---|---|---:|---:|---:|
| nearest-baseline | Cobertura efetiva | 0,90 p.p. | 0,00 p.p. | 271/619/82 |
| nearest-baseline | Prioridade atendida a tempo | 9,65 p.p. | 6,62 p.p. | 899/64/9 |
| nearest-baseline | Atraso controlável ponderado | 0,55 dias | 0,39 dias | 943/6/23 |
| nearest-baseline | Distância percorrida | -3,33 km | 0,00 km | 284/215/473 |
| nearest-baseline | Tempo total de planejamento | -107,37 ms | -23,97 ms | 0/0/972 |
| urgency-baseline | Cobertura efetiva | 12,50 p.p. | 12,78 p.p. | 635/324/13 |
| urgency-baseline | Prioridade atendida a tempo | 20,84 p.p. | 18,37 p.p. | 972/0/0 |
| urgency-baseline | Atraso controlável ponderado | 2,07 dias | 1,46 dias | 972/0/0 |
| urgency-baseline | Distância percorrida | 21,54 km | 15,30 km | 813/77/82 |
| urgency-baseline | Tempo total de planejamento | -109,14 ms | -25,49 ms | 0/0/972 |

Em cada linha da tabela acima, a média usa 972 pares: 324 cenários × 3 probabilidades de ausência. A mediana é o valor central desses pares.

### Ganho médio por chance de falha

| Falha | Baseline | Cobertura | Prioridade atendida a tempo | Atraso controlável | Distância |
|---:|---|---:|---:|---:|---:|
| 0% | nearest-baseline | 1,02 p.p. | 9,91 p.p. | 0,55 dias | -2,89 km |
| 0% | urgency-baseline | 12,28 p.p. | 21,56 p.p. | 2,06 dias | 21,17 km |
| 5% | nearest-baseline | 0,69 p.p. | 9,57 p.p. | 0,52 dias | -3,52 km |
| 5% | urgency-baseline | 12,20 p.p. | 20,74 p.p. | 2,04 dias | 21,43 km |
| 10% | nearest-baseline | 0,99 p.p. | 9,47 p.p. | 0,56 dias | -3,56 km |
| 10% | urgency-baseline | 13,01 p.p. | 20,22 p.p. | 2,11 dias | 22,04 km |

Em cada linha de probabilidade de ausência, a média usa 324 pares: um por cenário.

### Plano inicial, antes das falhas

| Baseline | Métrica | Ganho médio | Vitórias/empates/derrotas |
|---|---|---:|---:|
| nearest-baseline | Cobertura planejada | 0,89 p.p. | 82/242/0 |
| nearest-baseline | Prioridade atendida a tempo no plano | 11,10 p.p. | 309/15/0 |
| nearest-baseline | Atraso controlável planejado | 0,45 dias | 312/8/4 |
| nearest-baseline | Distância planejada | -1,22 km | 130/131/63 |
| urgency-baseline | Cobertura planejada | 11,59 p.p. | 210/114/0 |
| urgency-baseline | Prioridade atendida a tempo no plano | 19,02 p.p. | 315/6/3 |
| urgency-baseline | Atraso controlável planejado | 1,64 dias | 321/3/0 |
| urgency-baseline | Distância planejada | 21,21 km | 282/24/18 |

Cada linha de plano inicial compara 324 cenários. A probabilidade de ausência ainda não foi aplicada.

### Cinco condições mais desfavoráveis para prioridade atendida a tempo frente ao vizinho mais próximo

| Semente | Pacientes | Área | Dias úteis | Já vencidas | Falha | Ganho |
|---:|---:|---:|---:|---:|---:|---:|
| 20261009 | 15 | 1,00× | 5 | 50% | 0% | -4,09 p.p. |
| 20261009 | 15 | 1,00× | 5 | 50% | 5% | -4,09 p.p. |
| 20261009 | 15 | 1,00× | 5 | 50% | 10% | -4,09 p.p. |
| 20261010 | 90 | 1,00× | 10 | 25% | 0% | -1,33 p.p. |
| 20261010 | 90 | 1,00× | 10 | 25% | 5% | -1,33 p.p. |

O [relatório interativo](relatorio.html) mostra o efeito marginal de cada fator, a distribuição dos ganhos pareados e a contagem de vitórias/empates/derrotas. Os valores completos estão em [resumo-fatores.csv](resumo-fatores.csv); os registros por execução são regenerados em `experimentos/resultados/fatorial-caminhada/`.

## Limites de interpretação

- A área 1× preserva o contorno real; 0,5× e 2× são transformações geométricas para teste controlado e não representam territórios oficiais. Os pacientes, prioridades, prazos e ausências são sintéticos.
- Distâncias e durações vêm da API Table do OSRM local com perfil de caminhada e malha OpenStreetMap; pacientes sintéticos são conectados à rede pelo OSRM.
- A falha é um sorteio por tentativa de visita. Quando uma visita falha, ela permanece pendente e pode ser replanejada; os resultados efetivos incluem todas as visitas ainda não atendidas no fim do horizonte.
- Médias e quartis são descritivos das 3 sementes e níveis escolhidos, não estimativas populacionais nem intervalos de confiança. Tempo computacional depende da máquina; compare-o somente dentro da mesma execução.
- A generalização geográfica exige repetir a grade em outros territórios, e a validação operacional exige endereços, prevalência e equipe observados.

## Reprodução

```bash
npm run build --prefix artefato/packages/core
npm run build --prefix artefato/packages/server
npm run build --prefix experimentos
OSRM_BASE_URL=http://127.0.0.1:5000 npm run factorial --prefix experimentos
node experimentos/analise/generate_factorial_report.js
```
