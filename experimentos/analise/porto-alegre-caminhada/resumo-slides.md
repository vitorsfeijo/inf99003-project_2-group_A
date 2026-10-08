# Comparação das rotas em Porto Alegre — resumo para slides

## Frase para abrir a apresentação

Começamos com **132 territórios GeoSaúde**. 1 território não tinha caminho a pé completo. Avaliamos os **131 restantes**, cada um com **30 pacientes sintéticos**, uma equipe e um horizonte de **22 dias úteis**. A prioridade atendida a tempo da heurística foi **34,63%**, ante **28,18%** do vizinho mais próximo. A diferença é **6,45 pontos percentuais**, ou **22,9% em termos relativos** à média do vizinho mais próximo.

**O que a métrica mede:** some os pesos das visitas feitas a tempo. Divida pela soma dos pesos de todas as visitas da demanda inicial. Multiplique por 100. Visitas já vencidas antes da simulação contam se forem feitas no primeiro dia. Por exemplo, pesos 1, 3 e 5 somam 9 pontos. Se só a visita de peso 5 for feita a tempo, o resultado é 5 ÷ 9 = 55,56% dos pontos de prioridade. Não é a porcentagem de pacientes atendidos.

## Slide 1 — Prioridade atendida a tempo e caminhada

| Indicador | Principal | Vizinho próximo | Urgência | Variação ante o vizinho |
|---|---:|---:|---:|---:|
| Prioridade atendida a tempo | 34,63% | 28,18% | 17,93% | +22,9% |
| Cobertura efetiva | 98,07% | 98,23% | 98,55% | -0,2% |
| Atraso controlável | 2,76 dia(s) | 3,07 dia(s) | 3,69 dia(s) | -10,3% |
| Distância a pé | 69,60 km | 70,40 km | 97,06 km | -1,1% |
| Cálculo acumulado | 131,87 ms | 12,78 ms | 9,00 ms | ≈10× |

**Como falar:** “O ganho principal está nos pontos de prioridade atendidos a tempo. A cobertura total muda menos. A distância foi menor, mas o cálculo ficou mais caro.” A variação percentual é `(principal − vizinho) / vizinho`: positiva significa aumento do indicador, negativa significa redução. O tempo de cálculo é mostrado como múltiplo para evitar um percentual pouco legível; 0,13 s por simulação mensal ainda é curto em termos operacionais.

## Slide 2 — O ganho resiste às ausências?

| Chance de ausência por tentativa | Ganho de prioridade atendida a tempo ante o vizinho | Distância adicional ante o vizinho |
|---:|---:|---:|
| 0% | +6,91 p.p. | -0,48 km |
| 5% | +6,52 p.p. | -0,97 km |
| 10% | +5,94 p.p. | -0,95 km |

Foram 393 comparações pareadas: 131 territórios com caminhos completos × 3 probabilidades de ausência. Cada par compara a heurística principal com o vizinho mais próximo no mesmo território e com a mesma probabilidade de ausência. A principal venceu em prioridade atendida a tempo em 307 pares, empatou 58 e perdeu 28; essas três contagens somam 393. Caminhou mais em 156 pares. Frente à estratégia de urgência, a prioridade atendida a tempo média foi 93,1% maior e a distância média foi 28,3% menor.

## Slide 3 — O que foi comparado e o que ainda falta

- **Métodos:** vizinho próximo escolhe a próxima visita elegível mais perto; urgência ordena por peso clínico; a principal combina construção geográfica, 1.5-opt, realocação entre dias e recuperação de pendências prioritárias.
- **Desenho:** importamos 132 territórios GeoSaúde. 131 tinham matriz de caminhada completa; 1 foi excluído por falta de caminho a pé (lista em `resultados/porto-alegre-caminhada/exclusions.json`). Em cada território avaliado, simulamos 30 pacientes, uma equipe de 240 minutos por dia e 22 dias úteis. Repetimos cada território para ausência de 0%, 5% e 10% por tentativa e aplicamos as três estratégias. Assim, 131 territórios × 3 probabilidades de ausência × 3 estratégias = 1.179 execuções dinâmicas. A principal concluiu em média 69,7 atendimentos por execução. Esse valor pode superar 30 porque um paciente pode precisar de outra visita no mesmo mês. Todos os planos iniciais passaram por `verifyPlan`.
- **Leitura correta de “média de Porto Alegre”:** média das 131 regiões avaliadas, com **uma amostra sintética por região** e peso igual para cada região e taxa de falha. Não é estimativa populacional nem média de pacientes reais.
- **Modelo de custo:** distâncias e tempos obtidos pela API Table do OSRM local, preparado com a malha OpenStreetMap e perfil de caminhada. Pontos sintéticos são conectados à rede pelo OSRM; caminhos sem conexão fazem a execução falhar. Pacientes, prioridades, prazos e ausências não são observados. Portanto, os percentuais são **eficiência simulada do algoritmo**, não benefício clínico medido na população.

## Apuração e reprodução

Os números foram calculados a partir de [cada execução em CSV](../../resultados/porto-alegre-caminhada/dynamic.csv) e [JSON](../../resultados/porto-alegre-caminhada/dynamic.json), que são saídas regeneráveis da bancada. Para repetir:

```bash
npm run build --prefix artefato/packages/core
npm run build --prefix artefato/packages/server
npm run build --prefix experimentos
OSRM_BASE_URL=http://127.0.0.1:5000 npm run citywide:report --prefix experimentos
```

A [varredura fatorial da Restinga](../fatorial-caminhada/relatorio.html) detalha como número de pacientes, área, prazo, atraso inicial e falhas mudam o desempenho; ela é complementar e não foi usada para chamar o resultado acima de média da cidade.
