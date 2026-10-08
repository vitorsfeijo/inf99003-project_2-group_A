# Desenho do experimento para o colega dos slides

## O que foi simulado

A análise fatorial usa o território oficial da **US Restinga**, em Porto Alegre, com pacientes e perfis clínicos **sintéticos**. Cada instância tem uma equipe com 240 minutos por dia, início em 1º de outubro de 2026 e antecipação máxima de dois dias. O horizonte cobre 5, 10 ou 22 dias úteis. As três estratégias recebem a **mesma instância** e a **mesma matriz de caminhada**.

| Fator | Níveis |
|---|---|
| Pacientes | 15, 30, 45 e 90 |
| Área relativa ao território da Restinga | 0,5×, 1× e 2× |
| Horizonte | 5, 10 e 22 dias úteis |
| Demanda vencida ao iniciar | 0%, 25% e 50% (fração nominal) |
| Ausência por tentativa | 0%, 5% e 10% |

As sementes são `20261008`, `20261009` e `20261010`. Cada semente define um sorteio reproduzível de pacientes, prazos e prioridades. Os grupos de 15, 30 e 45 pacientes são subconjuntos da amostra de 90 da mesma semente.

**Contagem dos cenários:** 1 território base × 3 sementes × 4 quantidades de pacientes × 3 tamanhos de área desse território × 3 horizontes × 3 proporções de demanda vencida = **324 cenários distintos**. A probabilidade de ausência não cria um cenário novo; ela é aplicada durante a simulação. Todos os 324 cenários tinham caminhos a pé completos.

**Contagem dos planos iniciais:** 324 cenários × 3 estratégias = **972 planos**. Cada plano é calculado antes de qualquer ausência.

**Contagem das execuções dinâmicas:** 972 combinações de cenário e estratégia × 3 probabilidades de ausência = **2.916 execuções**. Uma execução acompanha 5, 10 ou 22 dias úteis, conforme o cenário. O plano é refeito a cada dia útil. As contagens constam no [`manifest.json`](../../experimentos/resultados/fatorial-caminhada/manifest.json).

## Estudo separado de 250 pacientes

O estudo longo usa a US Restinga, 250 pacientes sintéticos, uma equipe com 300 minutos por dia e as mesmas três sementes. Cada paciente precisa de uma visita inicial. Os prazos ficam entre outubro de 2026 e janeiro de 2027. O teste de capacidade mede quantas visitas cabem no plano inicial em quatro meses.

Para comparar os métodos, damos a todos um limite de 12 meses, de outubro de 2026 a setembro de 2027. São 261 dias de segunda a sexta, sem descontar feriados. Todos os nove planos iniciais, formados por 3 sementes × 3 estratégias, incluem as 250 visitas. A simulação termina quando todas são concluídas. Se um paciente falta, a visita continua pendente e o plano é refeito. O resultado principal é o número de dias úteis até a última visita, não os 12 meses disponíveis. Com 3 probabilidades de ausência (0%, 5% e 10%), há **27 execuções = 3 sementes × 3 estratégias × 3 probabilidades**.

A jornada de 300 minutos resolve uma limitação encontrada na jornada de 240 minutos: algumas visitas exigiam até 265,6 minutos para caminhar até o paciente, atender e voltar. Aumentar o número de meses não faria essas visitas caberem em um dia de 240 minutos. Veja as contagens e os tempos no [relatório do estudo longo](../../experimentos/analise/longo-250-caminhada/resumo.md).

## Caminhada pelo OpenStreetMap

O OSRM foi preparado com `foot.lua` sobre o extrato `PortoAlegre.osm.pbf` do OpenStreetMap. A API Table fornece quilômetros e minutos de percurso pela rede para cada par de posto e pacientes. A mesma matriz alimenta a heurística principal, o vizinho mais próximo e a regra de urgência, inclusive em todos os dias de replanejamento. O arquivo OSM usado tem SHA-256 `ee35c72a8d0cab781701470533afa409dfda7988c5b7c8d59ad4bcfe537055a0`.

O OSRM conecta cada coordenada sintética a um ponto da rede; a distância informada é o caminho entre esses pontos conectados. Isso é uma aproximação para endereços sintéticos, não um trajeto observado em campo. Para a área 0,5× ou 2×, o polígono e os pontos são escalados matematicamente; esses contornos não são territórios oficiais.

## O que mostrar e o que evitar

Mostre primeiro a grade feita em **um território base**, a US Restinga. Depois, mostre o efeito de aumentar a quantidade de pacientes. A comparação territorial em [`resumo-slides.md`](../../experimentos/analise/porto-alegre-caminhada/resumo-slides.md) é **outra análise**: começa com 132 territórios GeoSaúde, exclui um sem caminho completo e usa 30 pacientes sintéticos em cada um dos 131 restantes. Não junte as duas médias em um indicador.

Use os gráficos do [relatório interativo](../../experimentos/analise/fatorial-caminhada/relatorio.html) para mostrar ganhos pareados por número de pacientes e, se couber, por taxa de ausência. Cada barra agrega outros fatores e deve ter unidade (p.p., km ou dias). A distribuição dos ganhos ajuda a mostrar que uma média favorável pode conter derrotas.

Os resultados medem **desempenho simulado do algoritmo**. Não permitem afirmar redução observada de custos do SUS, melhora clínica real ou média de pacientes de Porto Alegre. A velocidade, a qualidade dos endereços, a demanda e as ausências reais ainda precisam de validação operacional.
