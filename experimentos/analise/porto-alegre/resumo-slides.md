# Comparação das rotas em Porto Alegre — resumo para slides

## Frase para abrir a apresentação

Em **132 territórios GeoSaúde de Porto Alegre**, simulando 22 dias úteis, 30 pacientes e uma equipe por território, nossa heurística entregou **21,2% mais resposta pronta ponderada pela prioridade** que o vizinho mais próximo. A cobertura cresceu **0,1%**, enquanto o custo de distância estimada foi **1,1% menor**. O atraso controlável caiu **10,1%**.

## Slide 1 — O ganho clínico e o custo

| Indicador | Principal | Vizinho próximo | Urgência | Variação ante o vizinho |
|---|---:|---:|---:|---:|
| Resposta pronta ponderada | 34,46% | 28,44% | 19,43% | +21,2% |
| Cobertura efetiva | 99,81% | 99,72% | 100,00% | +0,1% |
| Atraso controlável | 2,18 dia(s) | 2,42 dia(s) | 2,94 dia(s) | -10,1% |
| Distância estimada | 46,87 km | 47,37 km | 65,21 km | -1,1% |
| Cálculo acumulado | 138,47 ms | 14,06 ms | 9,85 ms | ≈10× |

**Como falar:** “O ganho principal está em quem é atendido a tempo, ponderado pela prioridade clínica. A cobertura total muda menos. A distância foi ligeiramente menor, mas o cálculo ficou mais caro.” A variação percentual é `(principal − vizinho) / vizinho`: positiva significa aumento do indicador, negativa significa redução. O tempo de cálculo é mostrado como múltiplo para evitar um percentual pouco legível; 0,14 s por simulação mensal ainda é curto em termos operacionais.

## Slide 2 — O ganho resiste às ausências?

| Chance de ausência por tentativa | Ganho de resposta pronta ante o vizinho | Distância adicional ante o vizinho |
|---:|---:|---:|
| 0% | +6,44 p.p. | -0,44 km |
| 5% | +6,11 p.p. | -0,57 km |
| 10% | +5,52 p.p. | -0,51 km |

Foram 396 comparações pareadas, três taxas de falha para cada território. A principal venceu o vizinho em resposta pronta em 283 casos, empatou 87 e perdeu 26. Teve distância maior em 163 casos. Ante a heurística de urgência, a resposta pronta cresceu 77,3% e a distância foi 28,1% menor; a urgência teve cobertura inicial maior (100,00%).

## Slide 3 — O que foi comparado e o que ainda falta

- **Métodos:** vizinho próximo escolhe a próxima visita elegível mais perto; urgência ordena por peso clínico; a principal combina construção geográfica, 1.5-opt, realocação entre dias e recuperação de pendências prioritárias.
- **Desenho:** 132 polígonos oficiais importados, 30 pacientes sintéticos em cada um, uma equipe de 240 min/dia, 22 dias úteis, velocidade estimada de 4,5 km/h e faltas de 0%, 5% e 10% por tentativa. Os pacientes podem precisar de novas visitas dentro do mês; a principal concluiu em média 71,1 atendimentos por território. As três estratégias receberam o mesmo cenário de cada território; todos os planos iniciais passaram por `verifyPlan`.
- **Leitura correta de “média de Porto Alegre”:** média das 132 regiões importadas, com **uma amostra sintética por região** e peso igual para cada região e taxa de falha. Não é estimativa populacional nem média de pacientes reais.
- **Limite decisivo:** quilômetros são calculados por Haversine, em linha reta; esta avaliação ainda não usa rotas a pé pelas ruas. Pacientes, prioridades, prazos e ausências não são observados. Portanto, os percentuais são **eficiência simulada do algoritmo**, não benefício clínico medido na população.

## Apuração e reprodução

Os números foram calculados a partir de [cada execução em CSV](../../resultados/porto-alegre/dynamic.csv) e [JSON](../../resultados/porto-alegre/dynamic.json), que são saídas regeneráveis da bancada. Para repetir:

```bash
npm run build --prefix artefato/packages/core
npm run build --prefix experimentos
npm run citywide:report --prefix experimentos
```

A [varredura fatorial da Restinga](../fatorial/relatorio.html) detalha como número de pacientes, área, prazo, atraso inicial e falhas mudam o desempenho; ela é complementar e não foi usada para chamar o resultado acima de média da cidade.
