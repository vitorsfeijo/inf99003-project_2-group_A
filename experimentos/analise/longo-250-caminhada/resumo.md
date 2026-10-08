# 250 pacientes: capacidade em quatro meses e tempo para concluir todas as visitas

## Desenho

Simulamos **250 pacientes** sintéticos na área da **US Restinga**. Usamos uma equipe com **300 minutos por dia**. Os prazos iniciais das visitas ficam entre outubro de 2026 e janeiro de 2027; parte começa vencida. O prazo máximo de operação é **12 meses**, de 1º de outubro de 2026 a 30 de setembro de 2027. São **261 dias de segunda a sexta**. Feriados não foram retirados. Cada paciente precisa de uma visita inicial. O intervalo de 1000 dias impede uma segunda visita dentro da simulação.

As distâncias e durações de caminhada vêm da matriz da API Table do OSRM com `foot.lua` e OpenStreetMap. Ela é a mesma para as três estratégias. Os endereços dos pacientes, prazos, prioridades e ausências são simulados. Foram usadas **3 sementes × 3 estratégias × 3 probabilidades de ausência = 27 execuções**. Nenhuma semente foi excluída.

## Teste de capacidade

Em um teste preliminar com jornada de 240 minutos, alguns pacientes não cabiam nem em um dia isolado: o trajeto de ida, a visita e a volta podiam exigir 265,6 minutos. Por isso a jornada foi fixada em **300 minutos por dia** nos dois testes abaixo. O prazo não resolve uma visita que ultrapassa a jornada diária.

Em **quatro meses** (outubro de 2026 a janeiro de 2027), a heurística colocou 249 a 250 de 250 visitas no plano inicial entre as três sementes. O vizinho mais próximo colocou 241 a 243 de 250. A regra de urgência colocou 246 a 248 de 250.

Em **12 meses**, todos os **nove planos iniciais** (3 sementes × 3 estratégias) colocaram **250 de 250 visitas**. A janela de 12 meses é um limite amplo comum para comparar quanto tempo cada método leva para terminar. Ela não é uma afirmação de que o atendimento precisa durar um ano. As contagens individuais estão em [capacity.csv](../../resultados/longo-250-caminhada/capacity.csv).

## Tempo para concluir as 250 visitas

O tempo abaixo é contado desde 1º de outubro de 2026 até a última visita concluída. Uma falta mantém a visita pendente, com o prazo original. O plano é recalculado depois de cada falta. Todos os planos gerados passam por `verifyPlan`. A mesma combinação de paciente e dia usa o mesmo sorteio de ausência entre estratégias.

| Ausência por tentativa | Estratégia | Visitas concluídas | Dias úteis até concluir: média (mín.–máx.) | Caminhada média | Tempo médio de cálculo |
|---:|---|---:|---:|---:|---:|
| 0% | main-heuristic | 250 de 250 | 87,67 (87 a 88) | 1.102,55 km | 22,14 s |
| 0% | nearest-baseline | 250 de 250 | 91,33 (91 a 92) | 1.272,51 km | 0,02 s |
| 0% | urgency-baseline | 250 de 250 | 88,33 (88 a 89) | 1.342,08 km | 0,01 s |
| 5% | main-heuristic | 250 de 250 | 88,33 (87 a 90) | 1.123,37 km | 116,20 s |
| 5% | nearest-baseline | 250 de 250 | 93,00 (92 a 94) | 1.290,58 km | 0,09 s |
| 5% | urgency-baseline | 250 de 250 | 89,33 (88 a 91) | 1.419,13 km | 0,04 s |
| 10% | main-heuristic | 250 de 250 | 88,33 (87 a 90) | 1.178,69 km | 151,78 s |
| 10% | nearest-baseline | 250 de 250 | 96,67 (95 a 98) | 1.351,63 km | 0,17 s |
| 10% | urgency-baseline | 250 de 250 | 91,67 (90 a 95) | 1.459,70 km | 0,09 s |

## Comparação com o vizinho mais próximo

A comparação usa **9 pares = 3 sementes × 3 probabilidades de ausência**. Cada par mantém os mesmos pacientes, prazos e matriz de caminhada.

A heurística terminou em **88,11 dias úteis** em média. O vizinho terminou em **93,67 dias úteis**. A diferença é **-5,56 dias úteis**. Valor negativo significa que a heurística terminou antes.

A caminhada média foi **1.134,87 km** com a heurística e **1.304,91 km** com o vizinho. A variação relativa foi **-13,03%**: (1.134,87 ÷ 1.304,91 − 1) × 100. Valor positivo significa mais caminhada da heurística.

| Ausência | Dias úteis: heurística | Dias úteis: vizinho | Diferença em dias úteis | Variação da caminhada |
|---:|---:|---:|---:|---:|
| 0% | 87,67 | 91,33 | -3,67 | -13,36% |
| 5% | 88,33 | 93,00 | -4,67 | -12,96% |
| 10% | 88,33 | 96,67 | -8,33 | -12,80% |

## Limites e arquivos

Todos os **9 planos iniciais** e todos os replanejamentos passaram por `verifyPlan`. A simulação para quando a visita inicial de todos os 250 pacientes é concluída. Quilômetros e minutos são previsões da rede de caminhada, não deslocamentos medidos em campo. As médias descrevem estas três sementes, não a população de Porto Alegre.

Os registros por execução estão em [dynamic.csv](../../resultados/longo-250-caminhada/dynamic.csv) e [dynamic.json](../../resultados/longo-250-caminhada/dynamic.json). O teste de capacidade está em [capacity.csv](../../resultados/longo-250-caminhada/capacity.csv). O [manifesto](../../resultados/longo-250-caminhada/manifest.json) registra o desenho. Passe `-- --refresh-matrices` ao comando de simulação quando mudar o grafo OSRM.
