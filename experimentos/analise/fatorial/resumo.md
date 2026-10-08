# Resultados para apresentação — experimento fatorial

## Desenho

- **Base geográfica:** território GeoSaúde US Restinga, Porto Alegre; polígono original no nível 1× e versões escaladas de forma sintética em 0,5× e 2× a área. Área original aproximada: 16,68 km².
- **Fatores independentes:** pacientes 15/30/45 (contagem); área 0.5/1/2×; horizonte 5/10/22 dias úteis; demanda já vencida 0/25/50%; falha por tentativa 0/5/10%.
- **Repetições:** sementes 20261008, 20261009, 20261010. Grade completa: 243 instâncias (quatro fatores de cenário × três sementes), 2187 execuções dinâmicas (três taxas de falha × três estratégias).
- **Controles:** uma equipe com 240 min/dia, início 2026-10-01, antecipação máxima 2 dias, uma visita por paciente e velocidade estimada de 4,5 km/h. Perfis clínicos e prioridades seguem a amostra sintética da fonte.
- **Sorteios comuns:** a mesma semente gera os mesmos pacientes e perfis antes da alteração de área, horizonte e atraso inicial; o sorteio de falha por paciente e data é igual entre estratégias e níveis de falha, com limiares de 0%, 5% e 10%.

## Comparação pareada

Valores positivos de ganho favorecem a heurística principal: principal menos baseline para coberturas; baseline menos principal para atraso, distância e tempo. Cada par usa a mesma instância e taxa de falha. Médias marginais usam o mesmo número de combinações nos demais fatores.

**Leitura sugerida:** frente ao vizinho mais próximo, a heurística obteve ganho médio de 6,64 pontos percentuais em resposta pronta ponderada (580 vitórias, 111 empates e 38 derrotas em 729 pares). Na distância efetiva, o ganho médio foi de 0,69 km, com 334 derrotas; com 10% de falha, o ganho médio de distância foi -0,25 km. Portanto, a vantagem clínica simulada é mais consistente que a economia de caminhada efetiva. O método principal também consumiu em média 33,14 ms adicionais de planejamento no horizonte completo.

| Baseline | Métrica | Ganho médio | Ganho mediano | Vitórias/empates/derrotas |
|---|---|---:|---:|---:|
| nearest-baseline | Cobertura efetiva | 0,89 p.p. | 0,00 p.p. | 171/531/27 |
| nearest-baseline | Resposta pronta ponderada | 6,64 p.p. | 5,36 p.p. | 580/111/38 |
| nearest-baseline | Atraso controlável ponderado | 0,38 dias | 0,29 dias | 644/57/28 |
| nearest-baseline | Distância percorrida | 0,69 km | 0,00 km | 339/56/334 |
| nearest-baseline | Tempo total de planejamento | -33,14 ms | -11,60 ms | 0/0/729 |
| urgency-baseline | Cobertura efetiva | 7,47 p.p. | 0,00 p.p. | 344/382/3 |
| urgency-baseline | Resposta pronta ponderada | 12,28 p.p. | 10,72 p.p. | 713/16/0 |
| urgency-baseline | Atraso controlável ponderado | 0,97 dias | 0,66 dias | 671/8/50 |
| urgency-baseline | Distância percorrida | 16,67 km | 13,17 km | 703/0/26 |
| urgency-baseline | Tempo total de planejamento | -33,79 ms | -11,90 ms | 0/0/729 |

### Ganho médio por chance de falha

| Falha | Baseline | Cobertura | Resposta pronta | Atraso controlável | Distância |
|---:|---|---:|---:|---:|---:|
| 0% | nearest-baseline | 0,91 p.p. | 6,22 p.p. | 0,35 dias | 1,28 km |
| 0% | urgency-baseline | 7,24 p.p. | 12,99 p.p. | 0,95 dias | 16,70 km |
| 5% | nearest-baseline | 0,83 p.p. | 6,49 p.p. | 0,38 dias | 1,05 km |
| 5% | urgency-baseline | 7,35 p.p. | 11,92 p.p. | 0,94 dias | 16,61 km |
| 10% | nearest-baseline | 0,91 p.p. | 7,21 p.p. | 0,41 dias | -0,25 km |
| 10% | urgency-baseline | 7,81 p.p. | 11,94 p.p. | 1,04 dias | 16,70 km |

### Plano inicial, antes das falhas

| Baseline | Métrica | Ganho médio | Vitórias/empates/derrotas |
|---|---|---:|---:|
| nearest-baseline | Cobertura planejada | 0,91 p.p. | 48/195/0 |
| nearest-baseline | Resposta pronta planejada | 10,11 p.p. | 218/25/0 |
| nearest-baseline | Atraso controlável planejado | 0,40 dias | 216/18/9 |
| nearest-baseline | Distância planejada | 1,15 km | 185/18/40 |
| urgency-baseline | Cobertura planejada | 7,45 p.p. | 108/135/0 |
| urgency-baseline | Resposta pronta planejada | 10,41 p.p. | 214/1/28 |
| urgency-baseline | Atraso controlável planejado | 0,73 dias | 226/1/16 |
| urgency-baseline | Distância planejada | 16,52 km | 241/0/2 |

### Cinco condições mais desfavoráveis para resposta pronta frente ao vizinho mais próximo

| Semente | Pacientes | Área | Dias úteis | Já vencidas | Falha | Ganho |
|---:|---:|---:|---:|---:|---:|---:|
| 20261009 | 30 | 0,50× | 10 | 25% | 5% | -3,92 p.p. |
| 20261009 | 30 | 0,50× | 10 | 25% | 10% | -3,92 p.p. |
| 20261009 | 30 | 0,50× | 22 | 25% | 5% | -3,92 p.p. |
| 20261009 | 30 | 0,50× | 22 | 25% | 10% | -3,92 p.p. |
| 20261010 | 30 | 1,00× | 10 | 25% | 0% | -3,89 p.p. |

O [relatório interativo](relatorio.html) mostra o efeito marginal de cada fator, a distribuição dos ganhos pareados e a contagem de vitórias/empates/derrotas. Os valores completos estão em [resumo-fatores.csv](resumo-fatores.csv); os registros por execução são regenerados em `experimentos/resultados/fatorial/`. A [validação separada da heurística](validacao-versoes.md) compara a versão atual com o commit anterior em outras sementes e em duas regiões.

## Limites de interpretação

- A área 1× preserva o contorno real; 0,5× e 2× são transformações geométricas para teste controlado e não representam territórios oficiais. Os pacientes, prioridades, prazos e ausências são sintéticos.
- Distâncias são Haversine, em linha reta. A velocidade de caminhada converte distância em minutos, mas não captura ruas, barreiras ou inclinação. Este experimento não mede custo de rota OSRM.
- A falha é um sorteio por tentativa de visita. Quando uma visita falha, ela permanece pendente e pode ser replanejada; os resultados efetivos incluem todas as visitas ainda não atendidas no fim do horizonte.
- Médias e quartis são descritivos das 3 sementes e níveis escolhidos, não estimativas populacionais nem intervalos de confiança. Tempo computacional depende da máquina; compare-o somente dentro da mesma execução.
- A generalização geográfica exige repetir a grade em outros territórios, e a validação operacional exige endereços, prevalência e equipe observados.

## Reprodução

```bash
npm run build --prefix artefato/packages/core
npm run build --prefix experimentos
npm run factorial --prefix experimentos
node experimentos/analise/generate_factorial_report.js
```
