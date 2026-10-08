# Métricas para os slides

Use o resultado da [simulação com caminhada](../../experimentos/analise/fatorial-caminhada/resumo.md). Os quilômetros e minutos vêm da rede OpenStreetMap calculada pelo OSRM.

## Indicador principal: prioridade atendida a tempo

Cada visita recebe um **peso de prioridade sintético de 1 a 5**. Peso 5 significa cinco pontos na conta. Peso 1 significa um ponto. São pesos de simulação; não são uma classificação clínica validada.

Uma visita conta como **feita a tempo** quando termina até seu prazo. Há uma regra para quem já estava vencido antes de começar a simulação: essa visita conta se for feita no primeiro dia. Isso impede que o algoritmo seja penalizado por dias de atraso anteriores à janela.

```text
Prioridade atendida a tempo (%) =
100 × (soma dos pesos das visitas feitas a tempo)
    ÷ (soma dos pesos de todas as visitas da demanda inicial)
```

**Exemplo:** há três visitas com pesos 1, 3 e 5. O total é 9 pontos. Só a visita de peso 5 foi feita a tempo. Resultado: `100 × 5 ÷ 9 = 55,56%`. Isso não quer dizer que 55,56% dos pacientes foram atendidos. Quer dizer que **5 dos 9 pontos de prioridade** receberam atendimento a tempo.

Visitas não realizadas continuam no total de baixo da fração. Uma visita feita tarde também continua no total, mas não entra na soma de cima. Por isso, a métrica considera ao mesmo tempo **quem foi atendido** e **se foi atendido a tempo**.

## Outros indicadores

| Indicador | Como calcular | O que significa |
|---|---|---|
| Cobertura efetiva (%) | Visitas concluídas ÷ visitas da demanda inicial × 100 | Fração de visitas concluídas, sem considerar o prazo ou o peso. |
| Atraso controlável ponderado (dias) | Para cada visita, conte dias de atraso a partir do maior entre início da simulação e prazo. Multiplique pelo peso. Some e divida pela soma dos pesos de todas as visitas. Pendências contam até o último dia simulado. | Atraso médio adicional, dando mais importância a visitas de maior peso. |
| Distância percorrida (km) | Some ida, trechos entre pacientes e retorno ao posto em cada dia executado. | Caminhada estimada pelo OSRM. Uma ida a paciente ausente também conta. |
| Tempo de planejamento (ms) | Some o tempo de cálculo dos planos diários. | Tempo do algoritmo no computador; não é tempo de trabalho em campo. |
| Dias úteis até concluir as 250 visitas | Conte os dias de segunda a sexta desde o início até a última visita inicial concluída. | Tempo de operação no estudo longo. Uma falta pode adiar a conclusão. |

O **plano inicial** descreve o cronograma antes das ausências. Na análise fatorial, a **simulação dinâmica** aplica ausência de 0%, 5% ou 10% por tentativa e refaz o plano a cada dia útil. Os slides devem dizer qual dos dois resultados está sendo mostrado.

No estudo longo de 250 pacientes, o plano é refeito após cada falta e a simulação para quando todos recebem a visita inicial. O prazo de 12 meses é o limite disponível, não o tempo automaticamente atribuído aos métodos. Compare os dias úteis efetivamente usados para concluir as visitas.

## Comparar métodos

Cada par usa o **mesmo cenário e a mesma probabilidade de ausência**. Na grade fatorial: 324 cenários × 3 probabilidades de ausência = **972 pares para cada método de referência**. O ganho de prioridade atendida a tempo é a porcentagem da heurística principal menos a porcentagem da referência. Sua unidade é **ponto percentual**. Exemplo: heurística com 25% e referência com 20% dão ganho de **5 pontos percentuais**, ou **25% relativo** à referência de 20%. São contas diferentes.

Para atraso e distância, apresentamos referência menos heurística. Ganho negativo de distância significa que a heurística caminhou mais. Toda média de ganho deve indicar qual referência foi usada e quantos pares entraram na conta.
