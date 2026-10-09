# Roteiro da apresentação final - PHVD-APS

Este roteiro acompanha os **22 slides de `slides-semana_4.tex`** e, em uma seção separada, os **4 slides de `apoio.tex`**. O tempo de referência é **18 a 20 minutos**, sem discussão. As falas são uma base para ensaio; os aprofundamentos preparam o apresentador para explicar detalhes sem colocá-los na tela. A descrição técnica completa está em [algoritmo_detalhado.md](algoritmo_detalhado.md).

A estética segue o tema Singapore das apresentações anteriores. A apresentação passa por problema, hipótese, literatura, entregas, modelo, artefato, métodos, experimentos, resultados e limites. O encerramento é: **conclusão → trabalhos futuros → referências → agradecimento**.

## Como preparar a fala

- Ensaiar a sequência completa. Não ler todas as legendas; elas registram condições que afetam a interpretação.
- Nas figuras, apontar primeiro entradas ou eixos e explicar uma comparação por vez.
- Usar “simulação”, “peso de prioridade” e “distância estimada” quando necessários. Não chamar as métricas de benefício clínico observado.
- Ler “p.p.” como pontos percentuais e distinguir diferença absoluta de ganho relativo.
- Manter os nomes principal, vizinho próximo e urgência.
- Usar `apoio.tex` somente quando uma pergunta exigir detalhes; os slides de apoio não integram a exposição principal.

Uma divisão possível entre três apresentadores é: pessoa 1, slides 1-6; pessoa 2, slides 7-12; pessoa 3, slides 13-22. Isso organiza a exposição e não atribui autoria individual.

## Slide 1 - Planejamento de Visitas Domiciliares na APS

**Tempo:** 20-30 segundos. **Objetivo:** identificar o trabalho e anunciar o que será demonstrado.

**Fala sugerida:**

“Nós somos Fabio, Tobias e Vitor, do grupo A. Neste segundo projeto desenvolvemos um artefato para planejar visitas domiciliares na Atenção Primária à Saúde. A ideia é combinar prioridades de atendimento, tempo disponível das equipes e distância entre domicílios. Além de gerar uma agenda, o sistema registra o que aconteceu nas visitas e permite replanejar. Vamos apresentar a formulação do problema, a solução que implementamos, como ela evoluiu e os resultados das comparações experimentais.”

**Detalhes para dominar:** APS significa Atenção Primária à Saúde. O enunciado da disciplina parte das visitas dos agentes comunitários; o artefato modela equipes e suas jornadas para apoiar esse planejamento. O projeto é um protótipo de pesquisa reutilizável, não uma implantação assistencial com pacientes reais. O título deve ser suficiente para situar o tema; não antecipar todos os percentuais nesta abertura.

**Transição:** “O desafio começa com uma decisão diária que parece simples, mas envolve critérios conflitantes.”

## Slide 2 - O problema de planejamento

**Tempo:** 45 segundos. **Objetivo:** explicar o conflito que motiva o algoritmo.

**Fala sugerida:**

“A equipe precisa decidir quem visitar, em qual dia e em que ordem. Um paciente pode ter um prazo mais próximo ou uma prioridade maior, mas morar longe. A equipe tem uma jornada limitada, e cada atendimento também consome tempo. Assim, escolher sempre a casa mais próxima pode deixar uma prioridade esperando; escolher só pela urgência pode produzir muito deslocamento. E existe uma segunda dificuldade: a visita planejada pode não acontecer, por exemplo, porque a pessoa estava ausente. Nesse caso precisamos atualizar a agenda mantendo a pendência.”

**Como usar a figura:** apontar os três critérios da esquerda para a direita. Depois seguir as setas até a agenda que reage a ausências. Não dizer que distância e prioridade são sempre incompatíveis: elas podem coincidir, mas não há garantia disso.

**Aprofundamento:** há quatro decisões interdependentes: selecionar o paciente, escolher o dia, atribuir a uma equipe e ordenar a rota. Melhorar apenas a ordem das casas não resolve a seleção nem a distribuição temporal. A duração de uma visita e o retorno à unidade precisam caber na jornada; não basta somar os tempos entre pacientes. O modelo busca apoiar a decisão de planejamento, sem substituir a definição clínica de prioridades.

**Transição:** “Nossa hipótese combina esses critérios em um planejamento de vários dias.”

## Slide 3 - Hipótese

**Tempo:** 40-50 segundos. **Objetivo:** apresentar a relação esperada entre a solução e os indicadores.

**Fala sugerida:**

“Nossa hipótese é que combinar prioridade clínica, horizonte móvel e busca local reduz o atraso com custo operacional controlado. Prioridade direciona a atenção para as necessidades de acompanhamento; o horizonte móvel permite rever os próximos dias; e a busca local reorganiza as rotas. Avaliamos essa expectativa com atendimento, atraso, deslocamento e tempo de cálculo. No fim vamos mostrar tanto os ganhos quanto os custos observados.”

**Como usar o slide:** ler a combinação acima da seta e, depois, o efeito esperado abaixo. Não formular uma pergunta adicional nem apresentar a hipótese como resultado já demonstrado.

**Aprofundamento:** a formulação original previa urgência, antecipação e inserção de menor custo. A versão final constrói com vizinho próximo, faz busca entre rotas e recupera pendências, mantendo o objetivo temporal. “Custo controlado” é uma expectativa avaliada pelos indicadores: o projeto não definiu um limiar universal de aumento aceitável com equipes reais. Os resultados são evidência descritiva em simulações, sem demonstração de benefício clínico ou ótimo global.

**Transição:** “A literatura ajudou a transformar essa hipótese em decisões concretas do projeto.”

## Slide 4 - Literatura e decisões de projeto

**Tempo:** 50-60 segundos. **Objetivo:** explicar como a literatura orientou a solução, sem fazer oito resumos de artigos.

**Fala sugerida:**

“A revisão reuniu oito trabalhos. Aqui estão três relações importantes com o que implementamos. Faria e o CONASS ajudaram a situar território e continuidade do cuidado, que aparecem no controle de polígonos e prazos. Os trabalhos sobre informação e coordenação motivam histórico, rastreabilidade e exportações. E Randriamihaja e colegas mostram uma aplicação de mapeamento e roteamento com jornada de agentes de saúde em Madagascar. Nosso recorte reúne o planejamento temporal, o registro de falhas e a comparação explícita de três estratégias.”

**Como usar a figura:** ler cada relação horizontalmente: fundamento à esquerda, decisão de engenharia à direita. A seta representa influência na formulação, não demonstração experimental de que a funcionalidade resolve um problema assistencial.

**Aprofundamento:** Barros, Aquino e Souza discutem heterogeneidade da APS; Matta e Morosini apresentam seus fundamentos; Rodrigues aborda coordenação das redes; Pinto e Rocha tratam informação para gestão; Bender discute TIC na APS; Faria e CONASS situam territorialização e acompanhamento. O estudo de Randriamihaja combina OSM e roteamento sob restrições de trabalho. Não afirmar que esse artigo “não considera prioridades ou retornos” sem uma verificação específica: a contribuição deve ser descrita pelo que fizemos, não por uma ausência presumida em outros trabalhos.

As datas usadas aqui seguem os fichamentos do repositório: Bender, **2024**; Pinto e Rocha, **2015**. Alguns documentos e slides antigos trazem outros anos. A bibliografia completa está ao final deste roteiro.

**Transição:** “Essas decisões deram origem a seis conjuntos de entregas.”

## Slide 5 - O que foi feito no projeto

**Tempo:** 50-60 segundos. **Objetivo:** resumir as entregas realizadas, sem uma linha do tempo.

**Fala sugerida:**

“O projeto produziu seis conjuntos de entregas. Revisamos oito trabalhos e formulamos o modelo com prazos, antecipação e jornada. Implementamos três estratégias em um núcleo compartilhado e uma aplicação com mapa, servidor, histórico e exportação. Integramos os territórios GeoSaúde e geramos pacientes sintéticos reproduzíveis. Avaliamos a solução em um piloto, no estudo dos territórios de Porto Alegre e no fatorial da Restinga. Por fim, revisamos a heurística, comparamos versões e analisamos métricas e limitações.”

**Como usar a figura:** percorrer os três blocos de cima e, depois, os três de baixo. Cada bloco representa um produto do projeto. Não usar a posição dos blocos como cronologia nem como divisão de autoria.

**Detalhes para dominar:** revisão bibliográfica e fichamentos estão em `papers/`; formulação em `projeto_de_pesquisa/`; aplicação em `artefato/`; cenários, simulações e relatórios em `experimentos/`. A aplicação integra registro de visitas concluídas ou não realizadas, versões de cenários e planos, comparação de estratégias e exportação CSV/GPX. GeoSaúde fornece polígonos e unidades reais; os pacientes, perfis e ausências são sintéticos. O piloto, a avaliação territorial e o fatorial usam protocolos diferentes, portanto suas médias não devem ser fundidas. A revisão da heurística foi comparada com a anterior em 36 instâncias separadas.

**Se pedirem mais detalhes:** o piloto histórico contém 11 cenários, 33 planos estáticos e 132 simulações dinâmicas. Na avaliação final com caminhada, o territorial contém 1.179 simulações, o fatorial 2.916 e o estudo de 250 pacientes 27. Esses números serão contextualizados nos slides de experimentos; aqui basta mostrar a abrangência das entregas. Os dados e relatórios permitem reprodução, sem transformar o protótipo em uma implantação assistencial validada.

**Transição:** “O modelo de planejamento define as regras que essas entregas implementam.”

## Slide 6 - Modelo de planejamento

**Tempo:** 60 segundos. **Objetivo:** definir prazo, horizonte, antecipação e capacidade.

**Fala sugerida:**

“O prazo de uma condição vem da última visita mais o intervalo máximo de acompanhamento. Também podemos informar um prazo inicial. Planejamos uma janela com N dias úteis e permitimos antecipação de até A dias corridos. A diferença entre essas unidades é importante. Cada rota sai da unidade e retorna a ela, e a soma do deslocamento com os atendimentos precisa caber na jornada da equipe. Quando registramos o resultado do dia, atualizamos o estado e planejamos novamente os dias futuros.”

**Como usar a figura:** apontar a janela azul, depois a verde que avança um dia. Os blocos são dias úteis esquemáticos. Não interpretar a figura como um calendário real com finais de semana desenhados.

**Aprofundamento:** cada paciente tem localização, duração de atendimento e condições com prioridade e intervalo. O gerador de demanda escolhe a condição com prazo mais antigo e usa prioridade como desempate. Não gera uma visita independente para todas as condições simultaneamente. O núcleo aceita diversas equipes e disponibilidades por data; os estudos finais apresentados mantêm uma equipe por território. O calendário implementado considera os dias úteis definidos pelas rotinas do núcleo; não prometer integração automática com calendários oficiais de feriados.

O verificador atual confere território, equipe existente, disponibilidade, jornada e repetição de paciente **dentro de cada rota**. Isso não equivale a uma prova global de todas as restrições imagináveis, nem prova de optimalidade. A legenda do slide usa “unicidade por rota” por esse motivo.

**Transição:** “Essas regras ficam em um núcleo que pode ser usado pela interface e pelos experimentos.”

## Slide 7 - Artefato computacional

**Tempo:** 45-55 segundos. **Objetivo:** mostrar os componentes e o valor da reutilização.

**Fala sugerida:**

“Construímos três módulos: web, server e core. A interface em React e Leaflet mostra o território, pacientes, rotas e comparações. A API em Fastify guarda cenários, planos e resultados no SQLite. O núcleo em TypeScript calcula a demanda, os custos, as estratégias e as métricas. Esse mesmo núcleo é chamado pela bancada experimental, sem depender do navegador ou do banco.”

**Como usar a figura:** apontar os rótulos web, server e core e seguir o fluxo mapa, API e núcleo. Em seguida mostrar que os experimentos também entram no núcleo e que os dados são versionados. CSV e GPX são resultados exportáveis, não métodos de otimização.

**Aprofundamento:** o monorepo separa `core`, `server` e `web`. O núcleo aceita objetos serializáveis e matrizes externas, sem importar React, Fastify ou SQLite. A persistência mantém versões dos cenários e sua associação com os planos e resultados. O histórico diferencia `completed` e `missed`. O sistema não deve mascarar falhas de roteamento nem assumir que uma visita agendada aconteceu.

As entradas com semente e configuração fixa reproduzem as amostras e decisões determinísticas. IDs e timestamps dos planos dependem do relógio e não precisam ser iguais para que as rotas sejam reproduzíveis. O verificador valida factibilidade implementada, não que a solução seja a melhor possível.

**Transição:** “Este é um exemplo concreto dos dados que entram nesse fluxo.”

## Slide 8 - Território, pacientes e uma rota

**Tempo:** 50-60 segundos. **Objetivo:** mostrar um exemplo geográfico e explicar a origem de cada elemento.

**Fala sugerida:**

“Aqui usamos o território da US Vila Ipiranga. O contorno e a unidade vêm do GeoSaúde; os trinta pacientes são sintéticos. A unidade está em vermelho, os pacientes em cinza e seis visitas selecionadas em azul. É a mesma amostra e rota da captura da interface que veremos a seguir. O plano de primeiro de outubro prevê seis atendimentos, com 3,42 quilômetros de deslocamento pela rede de caminhada e cerca de 221 minutos de trabalho. As linhas deste desenho ligam os pontos diretamente para mostrar a ordem; o trajeto pelas ruas aparece na interface.”

**Como usar a figura:** apontar o contorno, a unidade, os pacientes e a rota. A forma representa a área de atendimento da unidade, não o bairro inteiro. A escala usa uma projeção geográfica local. Diferenciar claramente os segmentos esquemáticos do percurso viário usado nos custos.

**Aprofundamento:** a base territorial é `geosaude_us_vila_ipiranga_20261126_30.json`, com proveniência da exportação GeoSaúde de julho de 2025. Na interface, uma nova amostra de 30 pacientes foi gerada com semente 20261008, início em 01/10/2026 e horizonte de 22 dias úteis. O cenário amostrado tem identificador `geosaude_us_vila_ipiranga_20261126_30_amostra_20261008_30_h22`. O desenho usa o plano da estratégia principal já exibido na aplicação, com seis visitas no dia inicial e jornada de 240 minutos. Os dados completos da amostra e da rota foram preservados em `figuras/08-mapa-vila-ipiranga-dados.json`. Custos e horários vêm do plano com matriz de caminhada; não foram calculados a partir do comprimento das linhas retas do desenho.

**Distinção experimental:** este é um exemplo visual da aplicação. Os estudos apresentados depois mantêm seus territórios, protocolos e resultados originais, inclusive o fatorial realizado na Restinga. A troca da ilustração não altera os dados desses experimentos.

**Transição:** “A aplicação apresenta esse mesmo exemplo nesta interface.”

## Slide 9 - Interface do protótipo

**Tempo:** 30-45 segundos. **Objetivo:** mostrar o artefato em uso, depois do exemplo esquemático do território.

**Fala sugerida:**

“Esta é uma captura da interface do protótipo. No mapa aparecem o território, a unidade, os pacientes sintéticos e a rota. À direita podemos selecionar a região, configurar quantidade e semente da amostra e consultar visitas, horários e métricas. A interface também permite comparar os três planos e exportar CSV e GPX. Assim, os resultados do núcleo podem ser explorados visualmente.”

**Como usar a imagem:** apontar o mapa e, em seguida, os controles e a lista de visitas à direita. Não ler todos os pacientes ou horários. A imagem vem de `mvp-aps.png`, mantido ao lado do arquivo principal.

**Detalhes para dominar:** esta captura mostra a US Vila Ipiranga, com 30 pacientes, semente 20261008 e início em 01/10/2026. Ela mostra o trajeto pela rede de caminhada com OSRM e a mesma amostra e rota do desenho anterior. Ambos são demonstrações da aplicação. Os resultados experimentais apresentados a seguir também usam OSRM a pé. O exemplo visual da Vila Ipiranga não substitui a base Restinga dos estudos fatorial e longo.

**Transição:** “Com os mesmos dados de entrada, a aplicação permite comparar três estratégias de planejamento.”

## Slide 10 - Três estratégias comparáveis

**Tempo:** 55-65 segundos. **Objetivo:** definir baselines e intervenção de forma suficiente para entender os resultados.

**Fala sugerida:**

“O baseline de urgência prioriza as visitas elegíveis conforme o atraso acumulado e o peso da necessidade clínica. O baseline geográfico escolhe a próxima visita elegível mais perto da posição atual, desde que ainda caiba na jornada com o retorno à unidade. A principal usa uma rota geográfica como ponto de partida e a modifica para melhorar o atendimento no horizonte. As três recebem os mesmos pacientes, calendário, jornada e matriz. Nos experimentos apresentados, o 1.5-opt está habilitado para todas.”

**Aprofundamento:** na implementação atual, urgência filtra visitas vencidas ou devidas no dia, ordena por `priorityScore` e acrescenta candidatos ao fim da rota enquanto houver capacidade. A pontuação gerada é `10 × atraso inicial em dias + 5 × peso da condição`. Não dizer que essa versão do baseline testa todas as posições de inserção, nem que seleciona sempre apenas o maior peso clínico.

O vizinho próximo escolhe proximidade entre os candidatos temporalmente elegíveis e viáveis. “Baseline” é uma referência simples para comparação; não significa que seja um método inútil. Em vários cenários ele é competitivo. Como o 1.5-opt também aparece nos baselines, o ganho da principal **não pode ser atribuído apenas ao 1.5-opt**. Ele avalia o conjunto de construção, movimentos entre rotas, recuperação e prioridade.

**Transição:** “A intervenção que distingue a principal é esta sequência de busca e reparo.”

## Slide 11 - Heurística principal: versão final

**Tempo:** 70-90 segundos. **Objetivo:** explicar o algoritmo final, distinguindo-o da proposta inicial.

**Fala sugerida:**

“A versão final começa pelo vizinho próximo. Primeiro faz uma busca econômica: move uma visita entre rotas ou troca visitas entre dias e equipes, procurando melhorar deslocamento e atraso ponderado. Depois vem uma etapa de reparo e prioridade. Ela tenta inserir visitas pendentes nos espaços viáveis e, em situações de capacidade cheia, pode substituir uma visita por outra mais prioritária sob condições de proteção do atendimento. Também valoriza responder prontamente às prioridades. Entre essas operações, melhora a ordem dentro das rotas com 1.5-opt.”

“Existe controle do orçamento de caminhada nas buscas, mas isso não significa que a distância final nunca possa aumentar. Quando o reparo encaixa pacientes adicionais, temos mais atendimentos e podemos ter mais deslocamento. Por isso a comparação de resultados precisa mostrar distância junto com cobertura e prazos.”

**Como usar a figura:** apontar primeiro construção geográfica, depois movimentos entre rotas, depois pendências/prioridades. Separar movimentação entre dias do 1.5-opt intra-rota, que está detalhado em `algoritmo_detalhado.md`, fora da exposição principal.

**Aprofundamento:** a função combina minutos de viagem com atraso controlável ponderado. Um ponto de prioridade atrasado um dia vale 12 minutos equivalentes; a segunda busca valoriza um ponto respondido prontamente em 24 minutos equivalentes. Esses coeficientes são escolhas do algoritmo e precisam de sensibilidade futura. Não são efeitos clínicos, dinheiro ou minutos de atendimento efetivamente economizados.

Cada busca tem limite de 80 movimentos aceitos no código. O orçamento é referenciado ao estado de entrada da respectiva fase; inserções de pendências podem modificar esse estado. Substituições exigem maior prioridade, capacidade e condições que protegem prontidão e atraso. A visita deslocada volta à fila de não alocadas. Não existe garantia de ótimo global.

**Transição:** “Além de gerar o plano, precisamos registrar o que acontece quando uma tentativa de visita falha.”

## Slide 12 - O que acontece quando a visita falha?

**Tempo:** 60 segundos. **Objetivo:** explicar a regra de replanejamento e a diferença entre previsão e execução.

**Fala sugerida:**

“Gerar uma rota não significa concluir as visitas. Depois da tentativa, registramos se ela foi concluída ou não realizada. Somente uma conclusão atualiza a data da última visita e, portanto, o próximo prazo. Se a pessoa estava ausente, preservamos o prazo original: ela continua pendente. O histórico recebe esse resultado, o cenário ganha uma versão atualizada e o planejamento futuro é recalculado. Na simulação, a equipe já se deslocou até a visita ausente, então esse deslocamento também conta no resultado.”

**Aprofundamento:** o núcleo recebe o estado e os resultados pela função `applyVisitResults`. Para `completed`, atualiza a condição correspondente; para `missed`, mantém a data anterior. O backend persiste versões, resultados e plano. Replanejar não deve reescrever retrospectivamente as visitas como se tivessem ocorrido.

Nos estudos territorial e fatorial, as visitas são simuladas e o plano é atualizado a cada dia útil. No estudo longo de 250 pacientes, a agenda restante é mantida e o plano é refeito após uma ausência; a simulação para quando todas as visitas iniciais são concluídas. A falha de uma pessoa numa data vem de um sorteio determinístico. Se duas estratégias visitam a mesma pessoa no mesmo dia, recebem o mesmo sorteio. Se visitam em datas diferentes, podem receber resultados diferentes. Portanto “sorteios comuns” é mais preciso que afirmar que todos os métodos tiveram exatamente a mesma lista de falhas realizadas.

**Transição:** “Usamos esse ciclo de planejar e registrar em três estudos finais complementares.”

## Slide 13 - Três estudos com rotas a pé

**Tempo:** 75-90 segundos. **Objetivo:** distinguir as perguntas dos três estudos e seus controles.

**Fala sugerida:**

“A avaliação final usa distâncias e durações pela rede de caminhada, calculadas pelo OSRM com OpenStreetMap. A matriz de cada cenário é comum às três estratégias. O primeiro estudo cobre 131 territórios de Porto Alegre, com trinta pacientes sintéticos por território e 22 dias úteis. Importamos 132 territórios, mas um não tinha caminhos completos a pé e foi excluído. Com três estratégias e três probabilidades de ausência, são 1.179 simulações. Esse estudo testa diversidade geográfica.”

“O segundo é um fatorial na Restinga. Variamos quantidade de pacientes, área, horizonte, proporção inicialmente vencida e probabilidade de ausência. Agora a quantidade inclui 15, 30, 45 e 90 pacientes. Com três sementes, são 324 cenários e 2.916 simulações. O terceiro acompanha 250 pacientes na Restinga até completar todas as visitas iniciais. Ele usa uma equipe de 300 minutos por dia e uma janela máxima de 261 dias úteis. São 27 execuções. Os dois primeiros estudos usam 240 minutos por dia, por isso mantemos os resultados separados.”

**Como usar o slide:** apontar as colunas da esquerda para a direita. Os números grandes identificam a escala de cada estudo: territórios, cenários e pacientes, respectivamente. Não somar esses números como se fossem a mesma unidade. Dizer “dias úteis” ao apresentar as janelas; a legenda abrevia a primeira para economizar espaço.

**Contas e controles para dominar:**

- Territorial: `131 × 3 estratégias × 3 taxas = 1.179` simulações e `131 × 3 taxas = 393` pares principal-vizinho. São 3.930 pacientes sintéticos nas amostras incluídas, uma amostra por território. A fonte territorial é o GeoSaúde de julho de 2025; a exclusão por falta de caminho consta da síntese atual. Não chamar a avaliação de censo da população ou de toda a rede assistencial.
- Fatorial: `1 território × 3 sementes × 4 quantidades de pacientes × 3 áreas × 3 horizontes × 3 proporções vencidas = 324` cenários. Todos tiveram caminhos completos segundo o relatório. `324 × 3 estratégias = 972` planos iniciais; `972 × 3 taxas = 2.916` simulações. Cada comparação com um baseline usa `324 × 3 = 972` pares, não 2.916 pares. Sementes: 20261008, 20261009 e 20261010, rótulos do gerador determinístico.
- Longo: `3 sementes × 3 estratégias × 3 taxas = 27` execuções e nove pares por baseline. Nenhuma semente excluída. O limite é de 01/10/2026 a 30/09/2027, 261 dias de segunda a sexta, sem retirar feriados. Não dizer que todos levam doze meses para atender: a simulação termina antes, ao completar as visitas.
- As taxas são 0%, 5% e 10% **por tentativa**, com sorteio comum para paciente e data. Mesmos pacientes, prioridades, calendário, jornada e matriz dentro de cada comparação. Todo plano gerado passa por `verifyPlan`.

**Diferença entre protocolos:** no territorial, podem ocorrer visitas recorrentes no mês. No fatorial, o intervalo impede recorrência dentro da janela e a agenda é recalculada diariamente. No estudo longo, cada paciente recebe uma visita inicial, o intervalo de 1000 dias impede recorrência e o plano restante é refeito depois de ausência. A comparação longa usa horizonte final fixo, não uma janela que avança indefinidamente.

**Transição:** “Começamos pela diversidade territorial e pela medida que expressa atendimento das prioridades.”

## Slide 14 - Porto Alegre: mais prioridade atendida a tempo

**Tempo:** 75-90 segundos. **Objetivo:** definir o indicador e apresentar magnitude absoluta e relativa.

**Fala sugerida:**

“Prioridade atendida a tempo é a soma dos pesos das visitas concluídas a tempo, dividida pela soma dos pesos da demanda inicial. Quem já estava vencido conta se for atendido no primeiro dia. É uma medida ponderada: uma visita de peso cinco contribui mais que uma de peso um. Na avaliação territorial, a principal atingiu 34,63%, contra 28,18% do vizinho próximo e 17,93% da urgência. Frente ao vizinho, são 6,45 pontos percentuais, ou 22,9% em termos relativos.”

“Já a cobertura efetiva foi 98,07% na principal e 98,23% no vizinho. Portanto a vantagem neste indicador vem de atender mais prioridade no momento adequado, e não de aumentar a fração total de visitas concluídas. Os resultados são médias das regiões e taxas avaliadas.”

**Como usar a figura:** explicar o que está no eixo antes de ler as barras. Apontar azul, verde e vermelho; depois o destaque numérico. Cobertura é atendimento em algum momento da janela, independentemente do peso e do prazo. Explicar oralmente a definição evita reintroduzir o slide de definição que foi removido a pedido do grupo.

**Exemplo minucioso para uma pergunta:** três visitas têm pesos 1, 3 e 5; o total é nove pontos. Se apenas a visita de peso cinco foi feita a tempo, o indicador é `100 × 5/9 = 55,56%`. Uma de três visitas foi pontual, mas 55,56% dos pontos de prioridade foram atendidos a tempo. Visitas tardias e pendentes continuam no denominador, sem entrar no numerador. Os pesos são sintéticos, não uma classificação clínica validada.

**Contas:** `34,63 − 28,18 = 6,45 p.p.`; `(34,63/28,18 − 1) × 100 ≈ 22,9%`. O relatório usa valores completos, então pode haver diferença na última casa ao calcular com números arredondados. Não dizer “22,9% mais pacientes”, “22,9 pontos percentuais” ou “22,9% de melhora clínica”.

**Aprofundamento:** médias com peso igual por território e taxa, sem ponderação pela população. Urgência teve cobertura efetiva de 98,55%, maior que os dois outros métodos, mas menor prioridade atendida a tempo. A principal não domina todos os indicadores. O denominador é a demanda inicial; a quantidade total de atendimentos territoriais pode superar trinta por causa da recorrência. Não calcular cobertura dividindo todas as visitas executadas por trinta.

**Transição:** “Precisamos avaliar essa vantagem junto com atraso, caminhada e cálculo.”

## Slide 15 - Porto Alegre: menor atraso, mais cálculo

**Tempo:** 60-75 segundos. **Objetivo:** apresentar custos da mesma avaliação territorial.

**Fala sugerida:**

“O atraso controlável ponderado foi 2,76 dias na principal, 3,07 no vizinho e 3,69 na urgência. Frente ao vizinho, é uma redução média de 10,3%. A caminhada estimada foi 69,60 quilômetros na principal, 70,40 no vizinho e 97,06 na urgência. A diferença ante o vizinho é pequena, 1,1% a menos. O cálculo acumulado foi 131,87 milissegundos na principal, contra 12,78 no vizinho e 9,00 na urgência: aproximadamente dez vezes o tempo do vizinho.”

**Como usar a figura:** ler um painel por vez. As cores têm o mesmo significado do slide anterior. Cada painel começa em zero e usa escala própria; altura em quilômetros não pode ser comparada com altura em dias ou milissegundos. Os números escritos nas barras são as médias de cada indicador.

**Aprofundamento das métricas:** atraso controlável desconta o atraso anterior ao começo da simulação: o ponto de referência de cada visita é o maior entre início e prazo. Multiplica-se o atraso pelo peso, somam-se os produtos e divide-se pela prioridade total da demanda inicial. Uma pendência no fim também acumula atraso até o encerramento. Os dias de atraso são de calendário; a capacidade de operação é definida em dias úteis. Caminhada soma trajetos de ida, entre visitas e volta à unidade, inclusive tentativas frustradas, usando a matriz OSRM. É previsão de rede, não pedômetro nem trajeto registrado em campo.

**Cálculo:** o tempo soma chamadas de planejamento ao longo da execução. Exclui obter a matriz OSRM, comunicação da interface e tempo em campo. `131,87 ms ≈ 0,132 s` descreve esta rodada de trinta pacientes; não extrapolar esse custo para 250 pacientes, cuja medição aparece adiante. O percentual de atraso vem das médias completas, por isso pode diferir ligeiramente da conta com 2,76 e 3,07 arredondados.

**Transição:** “Depois da comparação entre territórios, variamos a demanda e as condições de planejamento na Restinga.”

## Slide 16 - Fatorial: o ganho varia com a demanda

**Tempo:** 65-80 segundos. **Objetivo:** incluir a nova carga de 90 pacientes e explicar as médias marginais.

**Fala sugerida:**

“Nos 972 pares do fatorial, a principal atendeu, em média, 9,65 pontos percentuais a mais de prioridade a tempo que o vizinho. Venceu em 899 pares, empatou em 64 e perdeu em nove. Separando por quantidade de pacientes, o ganho foi 15,26 pontos com quinze, 10,79 com trinta, 7,87 com quarenta e cinco e 4,68 com noventa. Com a mesma capacidade de equipe, a vantagem média diminui com a carga, mas permanece positiva em todos esses níveis. Com noventa pacientes, foram 237 vitórias e seis derrotas em 243 pares.”

**Como usar a figura:** começar pelo agregado à direita e depois ler as barras da esquerda para a direita. O eixo mostra **ganho** em prioridade, e não o percentual de prioridade efetivamente atendida por um método. Cada barra tem 243 pares: `3 sementes × 3 áreas × 3 horizontes × 3 proporções vencidas × 3 taxas`. A média agrega igualmente os demais níveis. Não interpretar como efeito de adicionar um paciente específico nem como tendência comprovada para cargas não testadas.

**Protocolo detalhado:** pacientes 15/30/45/90; área 0,5/1/2 vezes a original; horizontes 5/10/22 dias úteis; demanda vencida 0/25/50%; ausência 0/5/10%. Uma equipe de 240 minutos, antecipação de dois dias corridos. A área original da US Restinga é cerca de 16,68 km². O nível 1× preserva o contorno; 0,5× e 2× são escalas geométricas sintéticas em torno da unidade, com coordenadas multiplicadas pela raiz quadrada da razão de área. Não são outras unidades oficiais. A matriz é recalculada para os pontos transformados na rede de caminhada.

**Aprofundamento:** a mediana do ganho de prioridade nos 972 pares foi 6,62 p.p. O ganho por ausência foi 9,91, 9,57 e 9,47 p.p. em 0%, 5% e 10%. Frente à urgência, o ganho médio foi 20,84 p.p., com 972 vitórias neste indicador. Estes números descrevem a grade e não significância inferencial. As três sementes e os cenários relacionados não são milhares de amostras independentes de serviços reais.

**Ressalva para a fala:** o ganho de prioridade vem acompanhado de 3,03% mais caminhada média que o vizinho (113,16 contra 109,83 km). O atraso controlável ponderado caiu 0,55 dia e o cálculo acumulado aumentou 107,37 ms em média. O gráfico deste slide mostra apenas prioridade; mencionar o compromisso de caminhada prepara a conclusão, sem apresentar outra figura. São resultados agregados das condições testadas na Restinga, não de todas as unidades.

**Transição:** “Por fim, mudamos a pergunta: quanto tempo uma equipe leva para concluir 250 visitas na Restinga?”

## Slide 17 - 250 pacientes: conclusão mais cedo

**Tempo:** 90-110 segundos. **Objetivo:** apresentar o novo estudo, seus ganhos e o custo computacional maior.

**Fala sugerida:**

“Este estudo usa 250 pacientes sintéticos na Restinga e uma equipe com 300 minutos por dia. Os prazos iniciais ficam entre outubro de 2026 e janeiro de 2027, com parte da demanda já vencida. Demos a todos os métodos um limite amplo de doze meses, 261 dias úteis, para comparar o tempo efetivamente usado até completar as visitas. Todas as 27 execuções concluíram 250 de 250 visitas.”

“As barras mostram a média de três sementes em cada taxa de ausência. Sem ausência, a principal terminou em 87,67 dias úteis e o vizinho em 91,33. Com 5%, foram 88,33 e 93,00. Com 10%, foram 88,33 e 96,67. Nos nove pares, a principal terminou em média 5,56 dias úteis antes: 88,11 contra 93,67. Também caminhou 13,03% menos: 1.134,87 contra 1.304,91 quilômetros por execução.”

“O custo computacional cresceu muito nesta escala: a principal acumulou, em média, 22 segundos sem ausências, 116 com 5% e 152 com 10%. Esses valores somam o cálculo inicial e os replanejamentos; não são o tempo de cada chamada nem a duração do atendimento. Assim, o estudo longo mostra um ganho logístico acompanhado de uma limitação de escala que merece trabalho futuro.”

**Como usar a figura:** anunciar que o eixo vertical é tempo até a última visita inicial **concluída**, em dias úteis. São barras de principal e vizinho, não de prioridade a tempo. A estratégia de urgência também participou das 27 execuções: suas médias foram 88,33, 89,33 e 91,67 dias úteis nas três taxas. O gráfico destaca o mesmo comparador usado nos slides anteriores; os demais dados estão no relatório e no apoio. Não ler todos os quilômetros de cada taxa se faltar tempo.

**Por que 300 minutos:** em teste preliminar de 240 minutos, algumas visitas isoladas exigiam até 265,6 minutos de ida, serviço e volta. Aumentar o horizonte não faz uma visita dessas caber na jornada. Por isso a equipe foi fixada em 300 minutos para todas as estratégias tanto na prova de capacidade quanto na comparação longa. Não apresentar isso como uma jornada observada da APS. Nos quatro meses iniciais, a principal alocou 249-250 visitas por semente, o vizinho 241-243 e a urgência 246-248. Nos doze meses, os nove planos iniciais alocaram todas as 250; esse limite comum evita começar a comparação longa com um método sem capacidade planejada para todos.

**Desenho e unidades:** são três sementes, uma equipe, ausência de 0/5/10%, antecipação de dois dias e intervalo de revisita de 1000 dias. Feriados não foram retirados. O limite de doze meses não significa que o atendimento demorou um ano; todos terminaram em 87-98 dias úteis. A simulação mantém a agenda restante quando não há falta e a refaz depois de ausência, preservando o prazo original. Não dizer que ela replaneja diariamente como o fatorial.

**Cálculo detalhado:** `93,6667 − 88,1111 ≈ 5,56` dias úteis; `(1.134,8689/1.304,91 − 1) × 100 ≈ -13,03%`. As diferenças por taxa são 3,67, 4,67 e 8,33 dias antes, calculadas com as médias completas. A caminhada caiu aproximadamente 13,36%, 12,96% e 12,80%. A média de cálculo acumulado da principal nos nove casos foi 96,71 s; no vizinho, 0,091 s; na urgência, 0,045 s. O aumento não pode ser escondido pelo valor de 0,132 s do estudo territorial.

**Interpretação:** concluir mais cedo e caminhar menos neste protocolo não demonstra maior pontualidade de cada visita, nem domínio em todos os critérios. As jornadas, demandas e regras de replanejamento diferem dos estudos anteriores; não reunir os três resultados em uma média única. Todos os planos e replanejamentos passaram pelo verificador, que confirma restrições do modelo, sem medir adequação clínica.

**Transição:** “Os três estudos trazem evidências diferentes; estes são os limites comuns.”

## Slide 18 - Limites da evidência

**Tempo:** 50-65 segundos. **Objetivo:** delimitar a conclusão com o modelo de caminhada atual.

**Fala sugerida:**

“Os contornos são reais, mas pacientes, pesos, prazos e ausências são sintéticos. Agora os caminhos já usam a rede OpenStreetMap com OSRM a pé, mas continuam sendo previsões: não medimos deslocamento em campo. O estudo territorial usa uma amostra por região; os dois estudos na Restinga usam três sementes. Mantemos uma equipe, e a jornada do estudo longo é diferente. A comparação é descritiva: indica eficiência simulada nestas condições, sem demonstrar benefício clínico ou superioridade em qualquer cenário.”

**Aprofundamento:** amostragem sintética não representa endereços, densidade populacional, prevalência, vulnerabilidade, disponibilidade ou capacidade observadas. O roteador conecta coordenadas à rede; a existência de um caminho no grafo não garante acesso real a um domicílio nem duração real para uma equipe. O território excluído do estudo geográfico também impede dizer “todos os 132 foram avaliados”. Escalas de área do fatorial são artificiais.

Os valores são médias e distribuições descritivas, sem intervalos de confiança populacionais. Há dependência entre cenários e sementes compartilhadas. O tempo computacional depende da máquina e exclui preparar ou consultar a matriz. O núcleo pode representar múltiplas equipes, mas estes estudos não validam experimentalmente esse caso. A validação formal verifica as restrições implementadas, não qualidade dos dados, benefício clínico ou ótimo global. A análise longa não retira feriados.

**Transição:** “Com esses limites, a conclusão combina atendimento e custo, em vez de escolher só uma métrica.”

## Slide 19 - Conclusão

**Tempo:** 50-65 segundos. **Objetivo:** interpretar os novos resultados antes dos trabalhos futuros.

**Fala sugerida:**

“Entregamos um artefato reutilizável e uma bancada reproduzível com custos pela rede de caminhada. Nas simulações, a heurística principal atendeu mais prioridade a tempo que o vizinho próximo e reduziu o atraso controlável médio. No fatorial, isso veio com 3,03% de caminhada adicional. No estudo de 250 pacientes, terminou 5,56 dias úteis antes e caminhou 13,03% menos. O cálculo foi maior, sobretudo no estudo longo. A hipótese recebe apoio descritivo para o objetivo temporal, enquanto o custo operacional depende do cenário.”

**Detalhes para dominar:** a vantagem territorial em prioridade foi +6,45 p.p.; a fatorial, +9,65 p.p. Estes estudos usam indicadores ponderados, não contagem de pacientes adicionais. O resultado longo mede conclusão de todas as visitas, com jornada de 300 minutos; não transportar seu ganho de caminhada para a jornada de 240 minutos do fatorial. Não declarar que a principal sempre anda menos, que a hipótese está provada universalmente, que a distância é estatisticamente equivalente ou que foi demonstrado impacto clínico.

**Mensagem do slide:** a prioridade temporal melhorou nos desenhos avaliados, com compromissos logísticos e computacionais. Manter a conclusão antes de trabalhos futuros. O agradecimento fica no último slide.

**Transição:** “Esses ganhos e custos orientam os próximos passos.”

## Slide 20 - Trabalhos futuros

**Tempo:** 50-70 segundos. **Objetivo:** propor extensões que ainda não foram concluídas.

**Fala sugerida:**

“O próximo passo operacional é usar demanda, jornadas e deslocamentos observados e avaliar o planejamento com equipes. Para generalizar, precisamos de mais sementes, outros territórios no fatorial e múltiplas equipes. O estudo de 250 pacientes mostrou que reduzir custo de cálculo e testar cargas maiores é uma frente relevante. Na parte metodológica, queremos variar os pesos, retirar etapas para medir sua contribuição, explorar compromissos de Pareto e comparar pequenas instâncias com uma referência exata.”

**Aprofundamento:**

- **Campo:** calibrar prioridades, duração das visitas, intervalos e ausências; medir uso do plano, correções humanas e tempos reais de caminhada. Ajustar calendários a feriados e disponibilidade observada. Um piloto ainda não foi realizado.
- **Generalização:** mais repetições e outros territórios para os estudos fatoriais e longos; variar quantidade, composição, disponibilidade e capacidade das equipes. O estudo territorial já amplia diversidade geográfica, mas usa uma única amostra por área.
- **Escala:** identificar os trechos caros, avaliar cache e reuso do planejamento, limites de busca e desempenho em cargas maiores. Medir cálculo inicial e replanejamento separadamente, além de matriz, servidor e interface. Os 22-152 s são soma de cálculo da principal por execução longa; não prometer uma meta de latência ainda não medida.
- **Método:** testar os pesos 12 e 24 e retirar etapas da busca e recuperação para atribuir ganhos; comparar soluções não dominadas em atendimento, atraso, caminhada e cálculo. Uma referência exata em instâncias pequenas pode estimar distância ao ótimo, sem exigir resolução exata de todos os casos.

**Mudança em relação à versão anterior:** não apresentar “avaliar com matriz OSRM” como futuro. A avaliação atual já usa `foot.lua` e OpenStreetMap nos três estudos. Ainda falta calibrar e validar esses custos em campo. Sensibilidade fatorial também já foi executada; o trabalho futuro é aprofundar e ampliar a avaliação.

**Transição:** “Estas são as referências e as bases que sustentaram o trabalho.”

## Slide 21 - Referências

**Tempo:** 10-15 segundos. **Objetivo:** reconhecer a bibliografia e as fontes territoriais e de caminhada.

**Fala sugerida:**

“As oito referências fundamentaram o problema e as decisões do projeto. Os territórios e unidades vêm do GeoSaúde de Porto Alegre; os custos de caminhada, do OpenStreetMap calculado pelo OSRM com perfil a pé. Os fichamentos, protocolos e resultados estão documentados no repositório.”

**Detalhes para dominar:** não ler oito títulos. Matta e Morosini permanecem sem data porque o fichamento não informa ano. GeoSaúde fornece contornos e unidades, sem fornecer pacientes reais. OpenStreetMap fornece a rede; OSRM calcula trajetos e matrizes. Não atribuir resultados próprios aos artigos da revisão.

**Transição:** passar ao agradecimento, sem retomar resultados.

## Slide 22 - Agradecimento

**Tempo:** 5-10 segundos. **Fala:** “Obrigado pela atenção.”

Manter a tela final. Abrir `apoio.tex` se uma pergunta exigir detalhes; os apoios não integram a apresentação principal e a conclusão não contém perguntas ou agradecimento.

## Slides de apoio - arquivo separado

### Apoio 1 - como medimos atendimento

**Quando usar:** pergunta sobre prioridade a tempo, cobertura, atraso ou denominadores.

**Fala detalhada:** “Prioridade a tempo soma os pesos das visitas concluídas até o prazo e divide pela prioridade de toda a demanda inicial. Quem já estava vencido conta se for atendido no primeiro dia. Cobertura conta visitas concluídas, sem pesos ou prazo. O atraso controlável mede os dias adicionais a partir do maior entre prazo e início da simulação, com ponderação pela prioridade. Cada indicador responde a uma pergunta diferente.”

**Exemplo detalhado:** pesos 1, 3 e 5 somam nove pontos. Só a visita de peso cinco foi concluída a tempo: cinco dos nove pontos, ou 55,56%, receberam atendimento a tempo. Isso corresponde a uma de três visitas pontuais, e não a 55,56% das pessoas. Se as três foram concluídas ao longo da janela, a cobertura é 100% mesmo com prioridade a tempo de 55,56%. Se apenas aquela foi concluída, a cobertura é 33,33%. Sem informação sobre as outras conclusões, a prioridade a tempo sozinha não determina cobertura.

**Denominadores e pendências:** o denominador não diminui quando um método deixa de atender uma visita. Pendências ficam na prioridade total e na demanda inicial. No atraso, uma pendência é contada até o último dia da simulação, com seu peso. Os dias de atraso são corridos, enquanto os dias disponíveis de operação são úteis. Pesos de simulação não são uma classificação clínica validada. Para o cálculo de atraso exato, usar o código de métricas e o simulador, que preservam a demanda inicial mesmo com recorrência territorial.

### Apoio 2 - 250 pacientes: capacidade e cálculo

**Quando usar:** pergunta sobre a jornada de 300 minutos, o limite de doze meses ou os tempos de computador.

**Fala detalhada:** “A jornada de 240 minutos deixava alguns pacientes inviáveis mesmo quando visitados sozinhos: ida, serviço e retorno podiam levar 265,6 minutos. O horizonte maior não corrige essa restrição diária. Por isso todos os métodos usam 300 minutos nos testes com 250 pacientes. Em quatro meses, a principal planejou 249-250 visitas por semente, o vizinho 241-243 e a urgência 246-248. Em doze meses, todos os nove planos iniciais incluíram as 250 visitas. A comparação dinâmica usa esse limite comum e para na conclusão, muito antes de doze meses.”

“O painel de cálculo mostra médias acumuladas da principal, por probabilidade de ausência: 22,14 s sem faltas, 116,20 s com 5% e 151,78 s com 10%. Cada valor resume três sementes. Inclui plano inicial e replanejamentos depois de ausência; não é tempo médio de uma chamada. O vizinho ficou em 0,02, 0,09 e 0,17 s por execução, respectivamente; urgência em 0,01, 0,04 e 0,09 s. As estratégias mais simples têm custo menor nesta implementação.”

**Números adicionais:** na urgência, os dias úteis médios até concluir foram 88,33/89,33/91,67 e a caminhada 1.342,08/1.419,13/1.459,70 km nas taxas de 0/5/10%. Na principal, a caminhada foi 1.102,55/1.123,37/1.178,69 km; no vizinho, 1.272,51/1.290,58/1.351,63. Todos terminaram com 250 visitas, em 87-98 dias úteis. Os 261 dias disponíveis são segunda a sexta sem exclusão de feriados. “Capacidade” é do plano previsto; “conclusão” é da execução com tentativas e faltas.

### Apoio 3 - protocolo e função de busca

**Quando usar:** pergunta sobre contagens fatoriais, parâmetros, orçamento ou operações da heurística.

**Fala detalhada:** “A grade tem quatro níveis de pacientes, três de área, horizonte e proporção vencida, além de três sementes: 324 cenários. As três estratégias e taxas produzem 2.916 simulações; são 972 pares contra cada referência. Todos usam matriz OSRM a pé. A busca combina tempo de viagem, atraso ponderado e pontos de prioridade atendidos a tempo. O coeficiente de atraso é 12; o de prontidão é zero na busca econômica e 24 na etapa posterior.”

**Definição técnica:** `J = T_viagem + 12 D_w − 24 P_pronta`. `D_w` é soma de peso vezes dias controláveis para as visitas consideradas nas mudanças de rota, não a média percentual do resultado. `P_pronta` soma pontos de prioridade, não o percentual mostrado nos gráficos. `T_viagem` vem da matriz. Os pesos representam minutos equivalentes de preferência na busca, sem unidade monetária ou validação clínica. A primeira fase usa coeficiente de prontidão zero; a segunda usa 24. As fases obedecem jornada, elegibilidade, duplicidade e orçamento de caminhada.

A heurística também insere ou substitui pendências sob regras de proteção; a função do slide não descreve sozinha todo o método. Até 80 movimentos são aceitos por busca entre rotas, não exatamente 80 passos de toda a heurística. O 1.5-opt usa reinserção e inversão de segmento para melhorar cada rota e está habilitado nos três métodos. Não atribuir todo ganho a essa melhoria comum. A análise detalhada e os exemplos estão em `algoritmo_detalhado.md`.

### Apoio 4 - reprodução dos três estudos

**Quando usar:** pergunta sobre dados, consistência ou como repetir a avaliação.

**Fala sugerida:** “O repositório documenta a preparação do OSRM local com OpenStreetMap e perfil de caminhada. Depois de compilar core, server e experimentos e definir o endereço do OSRM, executamos os geradores territorial, fatorial e longo. O relatório fatorial é gerado a partir das simulações já registradas. O estudo longo também depende da prova de capacidade. Os arquivos de matriz ficam em cache, com verificação e exclusões registradas.”

**Detalhes:** `factorial:report` lê resultados e não substitui `factorial`. `citywide:report` executa a comparação territorial e gera a síntese. `probe-long-capacity.mjs` avalia a capacidade antes de `long-horizon`. Se mudar o grafo OSRM, usar `--refresh-matrices` nas execuções. Tempos variam conforme a máquina; manter mesma rodada para comparar. Resultados brutos são regeneráveis e nem todos estão versionados no checkout: a síntese territorial e a tabela de fatores são as fontes disponíveis dos dois primeiros estudos, e CSV/JSON do longo estão presentes. Não afirmar uma nova execução integral da bancada ao apresentar esta revisão dos slides.

## Respostas preparadas para perguntas prováveis

**“Por que a prioridade a tempo é baixa se a cobertura é perto de 98%?”** Cobertura exige conclusão em algum momento. O indicador de prioridade também exige prazo: quem já estava vencido precisa ser atendido no primeiro dia. Pesos maiores contribuem mais. Um plano pode atender quase todos no fim da janela e ainda deixar muitas prioridades esperando.

**“São pacientes reais?”** Não. São coordenadas, perfis, pesos, prazos e faltas sintéticos em contornos GeoSaúde. Os caminhos são previstos pela rede OpenStreetMap/OSRM, sem medir atendimento ou caminhada real.

**“Ainda usam Haversine?”** Os resultados finais apresentados usam distâncias e durações da API Table do OSRM com perfil `foot.lua`. O piloto histórico é de outro protocolo. O mapa da Vila Ipiranga usa traços esquemáticos para mostrar a sequência, mas os custos de seu exemplo também vêm de OSRM.

**“A principal sempre caminha menos?”** Não. A média territorial foi 1,1% menor, mas houve mais caminhada em 156 de 393 pares. No fatorial, a média foi 3,03% maior e houve aumento em 473 de 972 pares. No longo, a média foi 13,03% menor que a do vizinho. Protocolos diferentes, resultados diferentes.

**“Isso confirma a hipótese?”** Há apoio descritivo ao objetivo de prazo e prioridade nas condições simuladas. Custo operacional controlado exige qualificar o cenário: o fatorial teve mais caminhada; o longo teve cálculo muito maior. Não é prova universal, ótimo global ou benefício clínico observado.

**“Por que excluir um território?”** A síntese registra falta de caminho a pé completo. Não substituímos essa matriz por aproximação para misturar modelos de custo. A base tinha 132 territórios e a avaliação incluiu 131. O motivo e a contagem devem acompanhar os resultados.

**“Por que 300 minutos no estudo de 250?”** Alguns pacientes não cabiam isoladamente em 240 minutos. Um prazo maior não resolve isso. A alteração foi comum às estratégias e explicitada; impede comparar diretamente o estudo longo com o fatorial de 240 minutos.

**“Doze meses para só 250 pacientes?”** Doze meses é limite amplo, não tempo efetivamente gasto. Todas as execuções concluíram em 87-98 dias úteis; a principal teve média 88,11 e o vizinho 93,67. O estudo mede uma visita inicial por pessoa, com prazos distribuídos e capacidade diária, não atendimento de todos no primeiro dia.

**“O algoritmo demora 152 segundos por replanejamento?”** Esse valor é soma de cálculo por execução na média de 10% de ausência. Inclui plano inicial e replanejamentos; não é latência de uma chamada. A limitação de escala existe, mas a métrica deve ser descrita corretamente.

**“Os métodos sofreram as mesmas faltas?”** Mesmos sorteios para paciente e data, com limiares comuns; agendas diferentes podem gerar faltas realizadas diferentes. Isso controla tentativas equivalentes sem forçar listas iguais de falhas.

**“O ganho vem do 1.5-opt?”** O 1.5-opt também está nos baselines. A avaliação compara estratégias completas. Uma ablação deve retirar cada fase para atribuir contribuição.

**“Por que não um solver exato?”** A proposta priorizou núcleo reutilizável e replanejamento por heurísticas. Não há comparação com ótimo global. Instâncias pequenas com referência exata são um próximo passo.

**“Por que uma equipe?”** É um controle de capacidade. O código representar várias equipes não significa que elas foram avaliadas nestes estudos.

**“Qual é a contribuição?”** Formulação temporal, núcleo compartilhado, interface com histórico e exportação, integração de caminhada, cenários com proveniência e avaliação reproduzível com compromissos explícitos. Não reivindicar invenção do 2-opt, vizinho próximo ou roteamento em saúde.

## Versão de exposição em 12 minutos

Passar rapidamente por literatura (4), entregas (5), arquitetura (7) e interface (9). Dedicar o centro da fala à hipótese (3), heurística (11), replanejamento (12), protocolo (13), resultado territorial (14), fatorial (16) e estudo de 250 pacientes (17). Resumir os custos territoriais (15), mas mencionar o compromisso de caminhada do fatorial ao apresentar o slide 16. Explicar prioridade a tempo oralmente em 14. Preservar limites (18), conclusão (19), futuro (20), referências (21) e agradecimento (22). Apoios reservados à discussão. Não reduzir a exposição omitindo jornada de 300 minutos ou custo computacional do estudo longo.

## Fontes do conteúdo e rastreabilidade

Roteiro atualizado em 08/10/2026 a partir dos resultados de caminhada presentes no repositório. A revisão dos slides não altera cenários, sementes, simulador ou dados experimentais. Os dois primeiros estudos são conferidos pelas sínteses e pela tabela de fatores disponíveis; o estudo longo também foi conferido diretamente no CSV de 27 execuções.

| Slides | Evidência no repositório | O que sustenta |
|---|---|---|
| 1-3 | [README](../../README.md), [projeto de pesquisa](../../projeto_de_pesquisa/projeto_de_pesquisa.md) | Problema e hipótese |
| 4, 21 | [Fichamentos](../../papers/_papers.md), [artefatos da literatura](../../papers/artifacts.md) | Oito trabalhos e decisões |
| 5 | [Diário](../../lab_notebook.md), [artefato](../../artefato/README.md), [experimentos](../../experimentos/README.md) | Entregas realizadas |
| 6-8, 10-12 | [Núcleo](../../artefato/packages/core/src/index.ts), [demanda](../../artefato/packages/core/src/demand/index.ts), [documentação](../../artefato/README.md) | Modelo, arquitetura e métodos |
| 8-9 | [Dados Vila Ipiranga](figuras/08-mapa-vila-ipiranga-dados.json), [proveniência](../../experimentos/provenance/geosaude_us_vila_ipiranga_20261126_30.json), [captura](mvp-aps.png) | Exemplo visual; os estudos controlados continuam na Restinga |
| 10-11; apoio 3 | [Principal](../../artefato/packages/core/src/strategies/main-heuristic.ts), [urgência](../../artefato/packages/core/src/strategies/baseline-urgency.ts), [vizinho](../../artefato/packages/core/src/strategies/baseline-nearest.ts), [1.5-opt](../../artefato/packages/core/src/improvement/one-half-opt.ts) | Implementação |
| 12-17 | [Simulador](../../experimentos/src/simulador/simulador-dinamico.ts), [métricas](../../artefato/packages/core/src/metrics/index.ts) | Ausências, denominadores e regras de horizonte |
| 13-15 | [Síntese territorial](../../experimentos/analise/porto-alegre-caminhada/resumo-slides.md) | 131 territórios, 1.179 simulações e exclusão |
| 13, 16, 19; apoio 3 | [Protocolo fatorial](../../experimentos/PROTOCOLO_FATORIAL.md), [resumo](../../experimentos/analise/fatorial-caminhada/resumo.md), [fatores CSV](../../experimentos/analise/fatorial-caminhada/resumo-fatores.csv) | 324 cenários, 2.916 simulações, 972 pares |
| 13, 17; apoio 2 | [Resumo longo](../../experimentos/analise/longo-250-caminhada/resumo.md), [CSV dinâmico](../../experimentos/resultados/longo-250-caminhada/dynamic.csv), [capacidade](../../experimentos/resultados/longo-250-caminhada/capacity.csv), [manifesto](../../experimentos/resultados/longo-250-caminhada/manifest.json) | 250 pacientes, 27 execuções, 300 min/dia e conclusão |
| Apoio 1 | [Definições das métricas](../apoio-banca/metricas.md), [métricas do núcleo](../../artefato/packages/core/src/metrics/index.ts), [simulador](../../experimentos/src/simulador/simulador-dinamico.ts) | Prioridade, cobertura e atraso, com seus denominadores |
| 18-20; apoio 4 | Protocolos, resultados, [README experimental](../../experimentos/README.md), [matriz viária](../../artefato/packages/server/src/routes/road-matrix.ts) | Limites, reprodução e próximos passos |

### Bibliografia consultada no projeto


1. Barros, R. D.; Aquino, R.; Souza, L. E. P. F. **Evolução da estrutura e resultados da Atenção Primária à Saúde no Brasil entre 2008 e 2019.** Ciência & Saúde Coletiva, 2022.
2. Matta, G. C.; Morosini, M. V. G. **Atenção Primária à Saúde.** Dicionário da Educação Profissional em Saúde, EPSJV/Fiocruz. O fichamento não informa ano; não inserir um ano presumido.
3. Faria, R. M. **A territorialização da Atenção Básica à Saúde do Sistema Único de Saúde do Brasil.** Ciência & Saúde Coletiva, 25(11), 4521-4530, 2020.
4. Rodrigues, L. B. B. et al. **A atenção primária à saúde na coordenação das redes de atenção: uma revisão integrativa.** Ciência & Saúde Coletiva, 19(2), 343-352, 2014.
5. CONASS. **A Atenção Primária à Saúde no SUS: avanços e ameaças.** CONASS Documenta, n. 38, Brasília, 2021. Organização: Eugênio Vilaça Mendes.
6. Pinto, L. F.; Rocha, C. M. F. **Inovações na Atenção Primária em Saúde: o uso de ferramentas de tecnologia de comunicação e informação para apoio à gestão local.** Ciência & Saúde Coletiva, 2015.
7. Bender, J. D.; Facchini, L. A.; Lapão, L. M. V.; Tomasi, E.; Thumé, E. **O uso de Tecnologias de Informação e Comunicação em Saúde na Atenção Primária à Saúde no Brasil, de 2014 a 2018.** Ciência & Saúde Coletiva, 29(1), e19882022, 2024.
8. Randriamihaja, M. et al. **Combining OpenStreetMap mapping and route optimization algorithms to inform the delivery of community health interventions at the last mile.** PLOS Digital Health, 3(11), e0000621, 2024.

### Comandos de reprodução das avaliações

Executar da raiz, com dependências instaladas e OSRM local preparado com a malha OpenStreetMap e perfil `foot.lua`. Consultar [experimentos/README.md](../../experimentos/README.md) para preparação e cache:

```powershell
$env:OSRM_BASE_URL = 'http://127.0.0.1:5000'
npm run build --prefix artefato/packages/core
npm run build --prefix artefato/packages/server
npm run build --prefix experimentos
npm run citywide:report --prefix experimentos
npm run factorial --prefix experimentos
npm run factorial:report --prefix experimentos
node experimentos/scripts/probe-long-capacity.mjs
npm run long-horizon --prefix experimentos
npm run verify:walking-matrices --prefix experimentos
```

`citywide:report` executa o estudo territorial e produz a síntese; `factorial` executa a grade e `factorial:report` analisa os dados gerados. O teste de capacidade deve anteceder `long-horizon`. `verify:walking-matrices` confere matrizes em cache. Se o grafo mudar, passar `-- --refresh-matrices` aos comandos de execução que geram as matrizes e regenerar a análise. As saídas ficam em `*-caminhada`. Não usar `factorial:validate`, que não consta mais dos scripts atuais, nem os antigos diretórios sem o sufixo de caminhada.
