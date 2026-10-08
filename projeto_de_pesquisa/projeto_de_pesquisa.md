# Projeto de Pesquisa

## Título

Planejamento de Visitas Domiciliares na Atenção Primária à Saúde: uma Heurística de Horizonte Móvel para Otimização de Rotas (PHVD-APS)

## Motivação/Introdução

A Atenção Primária à Saúde (APS) é reconhecida como o eixo estruturante dos sistemas de saúde universais. No modelo brasileiro, a Estratégia Saúde da Família organiza equipes multiprofissionais responsáveis por populações adscritas em territórios definidos, com ênfase no acompanhamento longitudinal de condições crônicas. Uma das ações centrais dessas equipes são as **visitas domiciliares**, que garantem o contato com pacientes que não conseguem se deslocar até a unidade de saúde e permitem identificar situações de risco, acompanhar condições como diabetes e hipertensão e prevenir agravamentos.

Na prática, porém, o planejamento dessas visitas é realizado de forma manual ou sem suporte computacional adequado. Isso gera acúmulo de pendências — visitas que deveriam ter ocorrido e não ocorreram —, distribuição desigual da carga de trabalho entre equipes e rotas ineficientes que aumentam o tempo de deslocamento em detrimento do tempo de cuidado. Quando uma visita não é realizada, o atraso se acumula para as visitas seguintes, comprometendo o acompanhamento periódico exigido por cada condição clínica.

O problema de planejamento de visitas domiciliares combina quatro decisões interdependentes: **seleção de quais visitas realizar**, **escolha do dia de atendimento**, **atribuição a uma equipe** e **ordenação da sequência de casas dentro de cada rota**. Em horizontes de múltiplos dias úteis, a decisão tomada hoje afeta a carga e os prazos dos dias seguintes. A reação a eventos reais — visitas concluídas ou não realizadas — exige **replanejamento** que preserve o histórico e recalcule apenas os dias futuros.

Este projeto propõe construir e avaliar um **artefato de pesquisa reutilizável** que, a partir dos dados de uma unidade de saúde, produza rotas para os próximos N dias de trabalho, priorize visitas pendentes, reduza o custo de deslocamento e atualize o planejamento ao registrar o resultado real de cada visita. O artefato inclui uma **interface gráfica mínima** com cadastros, mapa interativo com tiles do OpenStreetMap (via Leaflet.js ou Folium), visualização das rotas e exportação em CSV e GPX, além de um núcleo de otimização executável em lote para os experimentos.

**Pergunta de pesquisa:** em instâncias representativas de visitas domiciliares e falhas de atendimento, quanto uma heurística para uma janela móvel de N dias melhora o atendimento das pendências, o atraso acumulado, o deslocamento e o tempo de execução em relação a regras simples de planejamento?

**Hipótese:** uma seleção orientada por urgência e prazos futuros, seguida de inserção de menor custo e melhoria local, reduz o atraso acumulado após replanejamentos sem elevar excessivamente o deslocamento ou o tempo computacional.

## Objetivos

### Objetivo geral

Construir, implementar e avaliar experimentalmente uma heurística de horizonte móvel para o planejamento de visitas domiciliares na APS, comparando-a a baselines simples em instâncias sintéticas que representam diferentes cenários de capacidade, distribuição geográfica e frequência de falhas no atendimento.

### Objetivos específicos

1. **Modelar** o problema de planejamento de visitas domiciliares como um problema de seleção, roteamento e atribuição de visitas a equipes e dias, com restrições de capacidade de jornada, prazos por condição clínica e replanejamento após eventos reais.
2. **Implementar** dois baselines diários (urgência e geográfico) e uma heurística principal de horizonte móvel com antecipação, além de melhoria local por 1.5-opt.
3. **Construir** um gerador de cenários sintéticos reproduzíveis, um validador de planos e um avaliador de métricas, de modo que todos os experimentos sejam replicáveis a partir de semente e configuração.
4. **Desenvolver** uma interface gráfica mínima com mapa interativo (tiles do OpenStreetMap), cadastros de posto, pacientes e equipes, visualização das rotas por dia e equipe, registro dos resultados das visitas e exportação das rotas em CSV e GPX.
5. **Avaliar** os métodos em cenários com capacidade folgada, equilibrada e insuficiente, variando distribuição geográfica, fração de pendências, frequência de falhas e parâmetros da função de pontuação, e comparar os resultados por métricas de cobertura, atraso, deslocamento e tempo de execução.
6. **Analisar** as ameaças à validade experimental, incluindo a qualidade dos caminhos de caminhada disponíveis no OpenStreetMap, e discutir os limites de aplicação dos resultados ao contexto operacional do SUS.

## Trabalhos relacionados

Os trabalhos reunidos na revisão bibliográfica situam o projeto em duas dimensões: o contexto da APS brasileira e os métodos computacionais de otimização de rotas.

**Organização territorial e visitas domiciliares na APS.** Faria (2020) mostra que o território da APS não é apenas uma área geográfica, mas um espaço de responsabilidade sanitária, vínculos e necessidades de saúde. A territorialização define quais equipes acompanham quais famílias e em quais intervalos — dados diretamente utilizados no modelo proposto. Matta e Morosini (Fiocruz) e o documento CONASS (2021) reforçam que a Estratégia Saúde da Família exige acompanhamento longitudinal e periódico de condições crônicas, justificando o controle de intervalos máximos entre visitas como restrição central do problema. Rodrigues et al. (2014) identificam a falta de sistemas de informação capazes de acompanhar pendências, intervalos e encaminhamentos como uma das principais fragilidades da APS na coordenação do cuidado. Barros, Aquino e Souza (2022) evidenciam a heterogeneidade entre municípios e a relação entre privação socioeconômica e resultados de saúde, motivando cenários experimentais com distribuições geográficas e cargas distintas.

**Tecnologias de informação na APS.** Bender et al. (2021) mostram que, no Brasil, o uso de TIC na APS ainda é desigual e sofre com conectividade limitada, o que justifica a exportação de rotas em formatos portáteis (CSV, GPX) e o uso de mapas de fundo sem dependência de servidor próprio. Pinto e Rocha (2024) descrevem o observatório OTICS-RIO como exemplo de sistema que transforma registros cotidianos em informação de gestão, mostrando que a rastreabilidade das decisões de planejamento tem valor além da logística.

**Otimização de rotas para saúde comunitária.** Randriamihaja et al. (2024) apresentam a solução mais diretamente relacionada ao projeto: combinam dados do OpenStreetMap com um algoritmo de roteamento com restrição de jornada (VRPTW) para distribuir visitas de agentes de saúde em Madagáscar. Os autores mostram que distância euclidiana subestima consideravelmente os trajetos reais e que a escolha do número de agentes e da frequência das visitas tem impacto direto na cobertura. Em relação ao projeto proposto, as diferenças são: (a) este projeto calcula distâncias e durações sobre a rede de caminhada do OpenStreetMap por meio do OSRM; (b) este projeto incorpora explicitamente o replanejamento após eventos reais e o controle de versões do plano; (c) este projeto compara múltiplos métodos em vez de avaliar um único algoritmo.

A literatura de roteamento de veículos (VRP e variantes), roteamento com lucros e planejamento de atenção domiciliar ainda precisa ser incorporada à revisão para situar formalmente a heurística proposta e comparar as garantias de qualidade dos métodos. Essa complementação está prevista como parte da Etapa 5 do plano de trabalho.

## Metodologia

A pesquisa tem abordagem **quantitativa experimental** com dados sintéticos. Não serão utilizados dados identificáveis de pacientes; todos os cenários são gerados computacionalmente com sementes registradas para garantir reprodutibilidade.

**Dados e instâncias.** O gerador de cenários produz postos de saúde, pacientes com coordenadas, condições e datas de última visita, equipes com disponibilidade variável, polígonos de atuação, calendários e sequências de eventos (conclusões e visitas não realizadas) com taxas controladas. Cada cenário inclui semente, configuração completa e sequência de eventos fixados previamente para que métodos diferentes encontrem o mesmo evento ao programar a mesma visita.

**Cenários experimentais.** Os experimentos cobrem: capacidade folgada, equilibrada e insuficiente; pacientes próximos e espalhados; poucos e muitos atrasos; equipes com jornadas iguais e diferentes; horizontes curtos e longos; falhas isoladas e sucessivas. Casos-limite também são avaliados: zero pacientes, zero equipes, paciente fora do polígono, condição múltipla, visita mais longa que qualquer jornada, tentativa não realizada no último dia.

**Métodos implementados e comparados:**
1. *Baseline diário de urgência:* em cada dia, ordenar candidatos por vencimento e inserir cada um na equipe com menor custo adicional viável.
2. *Baseline diário geográfico:* construir cada rota pelo vizinho viável mais próximo, mantendo capacidade e regras de recorrência.
3. *Heurística principal com antecipação:* pontuar candidatos por atraso, peso clínico, proximidade do prazo e custo incremental de inserção; permitir antecipação dentro do limite A; impedir que visita futura de baixo peso desloque visita vencida.
4. *Melhoria local (1.5-opt):* combinar reinserção de nós e inversão de subsegmentos para reduzir deslocamento dentro de cada rota sem alterar os dias de atendimento.
5. *Referência exata em instâncias pequenas (opcional):* estimar a distância das heurísticas ao melhor resultado conhecido.

**Avaliação.** Todos os métodos recebem o mesmo estado inicial, o mesmo calendário, o mesmo limite de tempo e a mesma sequência de eventos reais. As métricas são: fração de pendências efetivamente concluídas; dias de atraso acumulados; atraso remanescente ao fim da janela; visitas concluídas e não realizadas; deslocamento efetivo e planejado; utilização e desequilíbrio de jornada; alterações entre versões; tempo de geração e replanejamento; memória máxima. Resultados do plano previsto e do simulado são separados. A comparação usa medianas e dispersão por cenário, além de análise de dominância de Pareto para evitar assumir um peso universal entre objetivos.

**Ferramentas e ambiente.** O núcleo de otimização é implementado em TypeScript, executável sem a interface para permitir testes em lote. A interface usa Leaflet.js com tiles do OpenStreetMap; os traçados e a matriz de deslocamento vêm do OSRM preparado com o perfil de caminhada. A persistência salva cenário, histórico real e todas as versões do plano em formato documentado.

**Análise de complexidade.** A análise assintótica esperada por etapa está documentada no plano de desenvolvimento, com premissas explícitas. Os limites serão verificados empiricamente variando n (pacientes), m (equipes), N (dias) e o número de eventos de replanejamento.

## Etapas e Cronograma

| Semana | Objetivo |
|---|---|
| Semana 1 | **Revisão bibliográfica e Entendimento do Domínio** — levantamento dos papers de APS e roteirização; fixar formato de entrada/saída, estados de visita, calendário, geometria, restrições e métricas; elaborar exemplo manual de N dias com falha e replanejamento. |
| Semana 2 | **Concepção do projeto** — redigir projeto de pesquisa e plano de desenvolvimento; definir pergunta de pesquisa, hipótese, modelo de dados, restrições, métricas e protocolo experimental; revisar literatura complementar de roteamento. |
| Semana 3 | **Núcleo de otimização e interface** — implementar gerador de cenários, validador, estado temporal, matriz de custos, verificador de planos, baselines de urgência e geográfico, heurística com antecipação, 1.5-opt, mini CRUD, mapa interativo com tiles OSM, visualização das rotas, registro de resultados e exportação em CSV e GPX. |
| Semana 4 | **Experimentos, avaliação e escrita do artigo** — executar experimentos de escala, falhas e sensibilidade em todos os métodos; calcular métricas, comparar resultados, construir tabelas e gráficos; interpretar limites e ameaças à validade; redigir e revisar o artigo final. |

## Recursos

| Semana | Fábio | Tobias | Vitor |
|---|---|---|---|
| Semana 1 | **Revisão bibliográfica** | **Revisão bibliográfica** | **Revisão bibliográfica** |
| Semana 2 | **Projeto de pesquisa e plano de desenvolvimento** | **Projeto de pesquisa e plano de desenvolvimento** | **Projeto de pesquisa e plano de desenvolvimento** |
| Semana 3 | **Experimentação e Construção do artefato** | **Experimentação e Construção do artefato** | **Experimentação e Construção do artefato** |
| Semana 4 | **Análise dos resultados e redação do artigo** | **Análise dos resultados e redação do artigo** | **Análise dos resultados e redação do artigo** |

**Recursos materiais e infraestrutura:** computadores pessoais dos integrantes; Python 3.x com bibliotecas numpy, pandas, shapely, gpxpy e folium/leaflet; repositório Git compartilhado para controle de versão do código e dos cenários experimentais; nenhum dado clínico real será utilizado.

## Referências

BARROS, Rafael Damasceno de; AQUINO, Rosana; SOUZA, Luis Eugênio Portela Fernandes. Evolução da estrutura e resultados da Atenção Primária à Saúde no Brasil entre 2008 e 2019. **Ciência & Saúde Coletiva**, 2022. Disponível em: https://www.scielo.br/j/csc/a/rRCVJhncQt95Db9xfMxW6TF/?lang=pt

BENDER, et al. O uso de Tecnologias de Informação e Comunicação em Saúde na Atenção Primária à Saúde no Brasil, de 2014 a 2018. **Ciência & Saúde Coletiva**, 2021. Disponível em: https://www.scielo.br/j/csc/a/CFj6GmKwqyCMHTrpNPJQLXM/abstract/?lang=pt

CONSELHO NACIONAL DE SECRETÁRIOS DE SAÚDE (CONASS). **A Atenção Primária à Saúde no SUS: avanços e ameaças**. CONASS Documenta, n. 38. Brasília, 2021. Organização: Eugênio Vilaça Mendes. Disponível em: https://www.conass.org.br/biblioteca/conass-documenta-38/

FARIA, Rivaldo Mauro de. A territorialização da Atenção Básica à Saúde do Sistema Único de Saúde do Brasil. **Ciência & Saúde Coletiva**, v. 25, n. 11, 2020, p. 4521-4530. Disponível em: https://www.scielosp.org/article/csc/2020.v25n11/4521-4530/

MATTA, Gustavo Corrêa; MOROSINI, Márcia Valéria Guimarães. Atenção Primária à Saúde. In: **Dicionário da Educação Profissional em Saúde**. Escola Politécnica de Saúde Joaquim Venâncio, Fiocruz. Disponível em: https://scholar.google.com/citations?view_op=view_citation&hl=pt-BR&user=uFFqgI4AAAAJ&citation_for_view=uFFqgI4AAAAJ:M3ejUd6NZC8C

PINTO, et al. Inovações na Atenção Primária em Saúde: o uso de ferramentas de tecnologia de comunicação e informação para apoio à gestão local. **Ciência & Saúde Coletiva**, v. 29, n. 1, 2024. Disponível em: https://www.scielosp.org/article/csc/2024.v29n1/e19882022/

RANDRIAMIHAJA, et al. Combining OpenStreetMap mapping and route optimization algorithms to inform the delivery of community health interventions at the last mile. **PMC**, 2024. Disponível em: https://pmc.ncbi.nlm.nih.gov/articles/PMC11542841/

RODRIGUES, Ludmila Barbosa Bandeira et al. A atenção primária à saúde na coordenação das redes de atenção: uma revisão integrativa. **Ciência & Saúde Coletiva**, v. 19, n. 2, 2014, p. 343-352. Disponível em: https://www.scielo.br/j/csc/a/nBKRxhLTPkdp489zfNGhKnt/abstract/?lang=pt