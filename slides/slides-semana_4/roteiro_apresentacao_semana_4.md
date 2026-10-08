# Roteiro da apresentação final - PHVD-APS

Este roteiro acompanha os **21 slides de `slides-semana_4.tex`** e, em uma seção separada, os **4 slides de `apoio.tex`**. O tempo de referência é **18 a 20 minutos**, sem discussão. As falas são uma base para ensaio; os aprofundamentos preparam o apresentador para explicar detalhes sem colocá-los na tela. A descrição técnica completa está em [algoritmo_detalhado.md](algoritmo_detalhado.md).

A estética segue o tema Singapore das apresentações anteriores. A apresentação passa por problema, hipótese, literatura, entregas, modelo, artefato, métodos, experimentos, resultados e limites. O encerramento é: **conclusão → trabalhos futuros → referências → agradecimento**.

## Como preparar a fala

- Ensaiar a sequência completa. Não ler todas as legendas; elas registram condições que afetam a interpretação.
- Nas figuras, apontar primeiro entradas ou eixos e explicar uma comparação por vez.
- Usar “simulação”, “peso de prioridade” e “distância estimada” quando necessários. Não chamar as métricas de benefício clínico observado.
- Ler “p.p.” como pontos percentuais e distinguir diferença absoluta de ganho relativo.
- Manter os nomes principal, vizinho próximo e urgência.
- Usar `apoio.tex` somente quando uma pergunta exigir detalhes; os slides de apoio não integram a exposição principal.

Uma divisão possível entre três apresentadores é: pessoa 1, slides 1-6; pessoa 2, slides 7-11; pessoa 3, slides 12-21. Isso organiza a exposição e não atribui autoria individual.

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

**Se pedirem mais detalhes:** o piloto contém 11 cenários, 33 planos estáticos e 132 simulações dinâmicas. O estudo territorial contém 1.188 simulações e o fatorial 2.187. Esses números serão contextualizados nos slides de experimentos; aqui basta mostrar a abrangência das entregas. Os dados brutos e relatórios possibilitam reprodução, sem transformar o protótipo em uma implantação assistencial validada.

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

**Tempo:** 45-60 segundos. **Objetivo:** dar um exemplo visual real da aplicação do núcleo.

**Fala sugerida:**

“Aqui usamos o território da US Restinga. O contorno vem do GeoSaúde; os trinta pacientes foram amostrados e não são moradores cadastrados. A unidade está destacada, e a linha azul é uma rota realmente gerada pelo núcleo para o primeiro dia com visitas. Neste exemplo, com velocidade estimada de quatro quilômetros e meio por hora e jornada de quatro horas, foram alocadas quatro visitas, com aproximadamente 7,84 quilômetros estimados. A interface permite selecionar uma região, amostrar pacientes, gerar e comparar planos, registrar resultados e exportar rotas.”

**Como usar a figura:** distinguir contorno, unidade, pontos cinza e pacientes selecionados em azul. A figura é um gráfico dos dados, não uma captura de tela nem uma rota pelas ruas. Não interpretar o traço reto que liga os pontos como caminho navegável.

**Aprofundamento:** o exemplo usa a instância `geosaude_us_restinga_20261106_30.json`, início em 01/10/2026, estratégia principal, 1.5-opt e velocidade ajustada para 4,5 km/h. O primeiro dia tem 224,6 minutos estimados de trabalho, incluindo 120 minutos de atendimento e cerca de 104,6 de deslocamento. As coordenadas estão projetadas localmente para visualização; o cálculo de custos do núcleo usa Haversine. O exemplo ilustra um plano, não uma realização após falhas.

O catálogo final contém 132 áreas. A interface oferece matriz e geometria OSRM quando há uma instância configurada com perfil de caminhada. Sem isso, a estimativa local sinaliza que trabalha em linha reta. Essa distinção precisa permanecer explícita.

**Transição:** “Com as mesmas entradas, comparamos três maneiras de escolher e ordenar as visitas.”

## Slide 9 - Três estratégias comparáveis

**Tempo:** 55-65 segundos. **Objetivo:** definir baselines e intervenção de forma suficiente para entender os resultados.

**Fala sugerida:**

“O baseline de urgência prioriza as visitas elegíveis conforme o atraso acumulado e o peso da necessidade clínica. O baseline geográfico escolhe a próxima visita elegível mais perto da posição atual, desde que ainda caiba na jornada com o retorno à unidade. A principal usa uma rota geográfica como ponto de partida e a modifica para melhorar o atendimento no horizonte. As três recebem os mesmos pacientes, calendário, jornada e matriz. Nos experimentos apresentados, o 1.5-opt está habilitado para todas.”

**Aprofundamento:** na implementação atual, urgência filtra visitas vencidas ou devidas no dia, ordena por `priorityScore` e acrescenta candidatos ao fim da rota enquanto houver capacidade. A pontuação gerada é `10 × atraso inicial em dias + 5 × peso da condição`. Não dizer que essa versão do baseline testa todas as posições de inserção, nem que seleciona sempre apenas o maior peso clínico.

O vizinho próximo escolhe proximidade entre os candidatos temporalmente elegíveis e viáveis. “Baseline” é uma referência simples para comparação; não significa que seja um método inútil. Em vários cenários ele é competitivo. Como o 1.5-opt também aparece nos baselines, o ganho da principal **não pode ser atribuído apenas ao 1.5-opt**. Ele avalia o conjunto de construção, movimentos entre rotas, recuperação e prioridade.

**Transição:** “A intervenção que distingue a principal é esta sequência de busca e reparo.”

## Slide 10 - Heurística principal: versão final

**Tempo:** 70-90 segundos. **Objetivo:** explicar o algoritmo final, distinguindo-o da proposta inicial.

**Fala sugerida:**

“A versão final começa pelo vizinho próximo. Primeiro faz uma busca econômica: move uma visita entre rotas ou troca visitas entre dias e equipes, procurando melhorar deslocamento e atraso ponderado. Depois vem uma etapa de reparo e prioridade. Ela tenta inserir visitas pendentes nos espaços viáveis e, em situações de capacidade cheia, pode substituir uma visita por outra mais prioritária sob condições de proteção do atendimento. Também valoriza responder prontamente às prioridades. Entre essas operações, melhora a ordem dentro das rotas com 1.5-opt.”

“Existe controle do orçamento de caminhada nas buscas, mas isso não significa que a distância final nunca possa aumentar. Quando o reparo encaixa pacientes adicionais, temos mais atendimentos e podemos ter mais deslocamento. Por isso a comparação de resultados precisa mostrar distância junto com cobertura e prazos.”

**Como usar a figura:** apontar primeiro construção geográfica, depois movimentos entre rotas, depois pendências/prioridades. Separar movimentação entre dias do 1.5-opt intra-rota, que está detalhado em `algoritmo_detalhado.md`, fora da exposição principal.

**Aprofundamento:** a função combina minutos de viagem com atraso controlável ponderado. Um ponto de prioridade atrasado um dia vale 12 minutos equivalentes; a segunda busca valoriza um ponto respondido prontamente em 24 minutos equivalentes. Esses coeficientes são escolhas do algoritmo e precisam de sensibilidade futura. Não são efeitos clínicos, dinheiro ou minutos de atendimento efetivamente economizados.

Cada busca tem limite de 80 movimentos aceitos no código. O orçamento é referenciado ao estado de entrada da respectiva fase; inserções de pendências podem modificar esse estado. Substituições exigem maior prioridade, capacidade e condições que protegem prontidão e atraso. A visita deslocada volta à fila de não alocadas. Não existe garantia de ótimo global.

**Transição:** “Além de gerar o plano, precisamos registrar o que acontece quando uma tentativa de visita falha.”

## Slide 11 - O que acontece quando a visita falha?

**Tempo:** 60 segundos. **Objetivo:** explicar a regra de replanejamento e a diferença entre previsão e execução.

**Fala sugerida:**

“Gerar uma rota não significa concluir as visitas. Depois da tentativa, registramos se ela foi concluída ou não realizada. Somente uma conclusão atualiza a data da última visita e, portanto, o próximo prazo. Se a pessoa estava ausente, preservamos o prazo original: ela continua pendente. O histórico recebe esse resultado, o cenário ganha uma versão atualizada e o planejamento futuro é recalculado. Na simulação, a equipe já se deslocou até a visita ausente, então esse deslocamento também conta no resultado.”

**Aprofundamento:** o núcleo recebe o estado e os resultados pela função `applyVisitResults`. Para `completed`, atualiza a condição correspondente; para `missed`, mantém a data anterior. O backend persiste versões, resultados e plano. Replanejar não deve reescrever retrospectivamente as visitas como se tivessem ocorrido.

Na bancada dinâmica, as visitas do dia são simuladas e o planejamento é atualizado a cada dia útil. A falha de uma pessoa numa data vem de um sorteio determinístico. Se duas estratégias visitam a mesma pessoa no mesmo dia, recebem o mesmo sorteio. Se visitam em datas diferentes, podem receber resultados diferentes. Portanto “sorteios comuns” é mais preciso que afirmar que todos os métodos tiveram exatamente a mesma lista de falhas realizadas.

**Transição:** “Usamos esse ciclo de planejar e registrar em dois estudos finais complementares.”

## Slide 12 - Dois estudos complementares

**Tempo:** 60-75 segundos. **Objetivo:** apresentar desenho, contagens e controles sem misturar os conjuntos.

**Fala sugerida:**

“No primeiro estudo usamos os 132 territórios importados de Porto Alegre. Cada um tem uma amostra sintética de trinta pacientes, uma equipe e 22 dias úteis. Com três estratégias e três probabilidades de falha, são 1.188 simulações. Esse estudo amplia a diversidade geográfica. No segundo, usamos a Restinga como base para variar cinco fatores em três níveis e três sementes: número de pacientes, área, horizonte, demanda inicialmente vencida e falhas. São 2.187 simulações. Esse estudo permite investigar a sensibilidade de forma controlada.”

**Aprofundamento:** a base geográfica vem do KMZ GeoSaúde de julho de 2025. Há 3.960 pessoas sintéticas no conjunto territorial, não 3.960 pacientes observados. Em 131 áreas a unidade foi associada por nome exato; US Ramos usa aproximação pela unidade mais próxima do centro geométrico, registrada na proveniência. Não chamar a base de um censo completo atualizado da rede de saúde.

No fatorial, quatro fatores de cenário têm três níveis; com três sementes, são `3^4 × 3 = 243` instâncias distintas. Cada uma recebe três taxas de falha e três métodos: `243 × 3 × 3 = 2.187`. Para cada baseline, a principal tem 729 pares dinâmicos. O protocolo usa sementes 20261008, 20261009 e 20261010, uma equipe de 240 minutos/dia, antecipação de dois dias corridos e 4,5 km/h.

**Diferença essencial:** no estudo territorial podem ocorrer novas visitas dentro do mês após uma conclusão. O fatorial usa intervalo de 60 dias para evitar recorrência dentro da janela; cada pessoa tem uma visita candidata. Não comparar contagem de atendimentos entre esses protocolos sem essa ressalva.

**Transição:** “Vamos aos resultados. Ao introduzir o gráfico, explico a medida de resposta pronta.”

## Slide 13 - Porto Alegre: maior resposta pronta

**Tempo:** 60-75 segundos. **Objetivo:** apresentar o resultado central com magnitude absoluta e relativa.

**Antes de ler o gráfico:** explicar em uma frase a métrica: resposta pronta é a fração da prioridade da demanda inicial atendida no primeiro dia, se já vencida, ou até o prazo, se futura. Cobertura indica atendimento em algum momento da janela. A ponderação usa o peso clínico, e não o índice de ordenação do baseline.

**Fala sugerida:**

“A principal atingiu 34,46% de resposta pronta ponderada, contra 28,44% do vizinho próximo e 19,43% da urgência. Em relação ao vizinho, a diferença é de 6,02 pontos percentuais, ou 21,2% em termos relativos. O ganho é principalmente temporal e de prioridade: a cobertura total já era muito alta, 99,81% na principal e 99,72% no vizinho. Portanto não estamos mostrando um grande aumento no número de pessoas atendidas, e sim uma melhora em quando a demanda prioritária é atendida.”

**Como usar a figura:** apresentar as três barras, depois apontar o destaque numérico. Ler as duas unidades explicitamente. A conta relativa é `(34,46 − 28,44) / 28,44 × 100`; diferenças de arredondamento podem surgir se usada a média completa em vez dos valores exibidos.

**Aprofundamento:** são médias com peso igual para cada território e cada uma das três taxas de falha. Não é uma média ponderada pela população dos bairros nem por volume observado de pacientes. A comparação com urgência é favorável à principal na prontidão, mas urgência teve cobertura efetiva média de 100%, um pouco superior. Não afirmar domínio em todas as métricas.

Não dizer “21,2% mais pacientes” ou “21,2 pontos percentuais”. Não dizer que houve redução observada de internações ou melhora clínica de 21,2%. Os pesos e os pacientes são sintéticos.

**Transição:** “Esse ganho precisa ser avaliado junto ao deslocamento e ao custo de cálculo.”

## Slide 14 - O ganho tem custos e limites

**Tempo:** 65-80 segundos. **Objetivo:** mostrar o compromisso entre atendimento e custo.

**Fala sugerida:**

“No atraso controlável, a principal teve 2,18 dias, contra 2,42 do vizinho e 2,94 da urgência. Frente ao vizinho, a queda média foi de 10,1%. A distância estimada ficou muito próxima: 46,87 quilômetros na principal e 47,37 no vizinho, uma diferença média de 1,1%; a urgência ficou em 65,21. Já o cálculo acumulado foi mais caro: 138,47 milissegundos, contra 14,06 e 9,85. Assim, houve melhora média de prazo, pequena diferença média de caminhada e um aumento claro do trabalho computacional.”

**Como usar a figura:** ler um painel por vez. As cores mantêm os métodos do slide anterior. Cada painel tem sua própria escala e parte de zero; não comparar a altura de uma barra de quilômetros com uma de dias ou milissegundos.

**Aprofundamento:** o atraso mostrado é ponderado e controlável, não a soma de todos os dias de atraso histórico. A distância dinâmica inclui rotas tentadas, inclusive ausências. O tempo é o cálculo acumulado ao longo do horizonte simulado e não uma única chamada, nem tempo de interface, rede, OSRM ou deslocamento.

138,47 ms são aproximadamente 0,14 segundo na execução registrada. Isso ajuda a interpretar a ordem de grandeza, mas não comprova desempenho em qualquer máquina, número de pacientes ou escala. Não dizer “viável em produção” apenas por esse resultado. A média de distância próxima também não estabelece equivalência estatística ou “empate técnico”; existem cenários com distâncias maiores, mostrados a seguir.

**Transição:** “Quando separamos as probabilidades de ausência, podemos ver se a vantagem desaparece.”

## Slide 15 - O ganho permanece com ausências

**Tempo:** 50-65 segundos. **Objetivo:** apresentar robustez média e variabilidade entre pares.

**Fala sugerida:**

“O ganho médio de resposta pronta frente ao vizinho foi de 6,44 pontos percentuais sem falhas, 6,11 com 5% de chance de falha e 5,52 com 10%. A vantagem média permaneceu positiva nos três níveis. Mas isso não acontece em todos os casos: nos 396 pares de território e taxa, a principal venceu 283, empatou 87 e perdeu 26 em resposta pronta. A distância foi maior em 163 pares. Por isso a média favorável não deve esconder situações em que o custo cresce ou a vantagem desaparece.”

**Aprofundamento:** 396 é `132 territórios × 3 taxas`, comparando a principal com um baseline. O total de 1.188 simulações inclui os três métodos. 283 vitórias correspondem a cerca de 71,5% dos pares; isso é frequência descritiva no desenho, não probabilidade estimada de sucesso em uma população de equipes reais.

Os valores do eixo horizontal são chances por tentativa. Não significam que exatamente 5% ou 10% dos pacientes perderam uma visita. Uma pessoa pode falhar em uma tentativa e ser atendida depois. Os sorteios comuns controlam paciente e data, mas estratégias distintas podem programar datas distintas. Não transformar a linha em previsão para probabilidades de falha fora das avaliadas.

**Transição:** “Também variamos a demanda e os demais fatores de forma controlada na Restinga.”

## Slide 16 - Fatorial: o ganho varia com a demanda

**Tempo:** 60-75 segundos. **Objetivo:** mostrar sensibilidade e limites do ganho de deslocamento.

**Fala sugerida:**

“No fatorial, a diferença média de resposta pronta frente ao vizinho foi de 6,64 pontos percentuais. A principal venceu em 580 dos 729 pares, empatou em 111 e perdeu em 38. As barras mostram médias marginais por tamanho de demanda: o ganho foi de 10,47 pontos com quinze pacientes, 5,25 com trinta e 4,20 com quarenta e cinco. Nessas condições, o ganho médio diminuiu quando aumentamos a demanda mantendo a mesma equipe. Na distância, a vantagem foi menos consistente: houve 334 derrotas e, no nível de 10% de falha, a principal percorreu em média 0,25 quilômetro a mais.”

**Como usar a figura:** apresentar o ganho agregado, depois explicar que cada barra agrega igualmente as outras combinações. Não chamar a barra de quinze pacientes de “resultado da cidade” nem comparar diretamente seu valor com a média territorial.

**Aprofundamento:** cada nível de pacientes agrega 243 pares. As amostras de 15 e 30 são subconjuntos aninhados da de 45 por semente. A jornada fica em 240 minutos, portanto a demanda cresce sem aumento de capacidade. Área 0,5× ou 2× é obtida escalando coordenadas por raiz quadrada do fator em torno da unidade; não são novos territórios oficiais.

A diferença média de distância em todos os pares foi 0,69 km menor, com mediana zero e 339 vitórias, 56 empates e 334 derrotas. Com 10% de falha, o sinal inverte: 0,25 km **adicional**. A mediana de resposta pronta foi +5,36 p.p. Frente à urgência, o ganho médio de prontidão foi +12,28 p.p. e a distância média foi 16,67 km menor. Esses dados reforçam que a escolha do baseline importa.

**Transição:** “Esses resultados são úteis, desde que respeitemos os limites do desenho.”

## Slide 17 - Limites da evidência

**Tempo:** 50-65 segundos. **Objetivo:** delimitar o alcance da conclusão sem retirar o valor do experimento.

**Fala sugerida:**

“Os contornos são reais, mas pacientes, prioridades, prazos e ausências são simulados. Os quilômetros apresentados usam Haversine, então não capturam ruas, barreiras ou inclinação. O estudo territorial usa uma amostra por região, e o fatorial usa três sementes em uma região base. Ambos mantêm uma equipe. Finalmente, a análise é descritiva: há ganho médio em indicadores de atendimento, mas isso não demonstra superioridade universal nem benefício clínico real.”

**Aprofundamento:** a distribuição de pacientes é uniforme nos polígonos; não representa densidade populacional, endereços, prevalência, vulnerabilidade ou equipe observada. Há compartilhamento de amostras e sorteios entre níveis do fatorial. As execuções não devem ser tratadas como 2.187 observações independentes de serviços reais. Quartis não são intervalos de confiança.

A aplicação já aceita uma matriz de ruas; entretanto essa integração não altera retroativamente o modelo de custo do experimento. O tempo de cálculo é dependente do equipamento. O núcleo aceita múltiplas equipes, mas os resultados principais não avaliam automaticamente esse caso. Também faltam estudo amplo de escala, comparação exata e análises que separem a contribuição de cada etapa da principal.

**Transição:** “Com esses limites em mente, podemos interpretar o principal resultado do projeto.”

## Slide 18 - Conclusão

**Tempo:** 45-60 segundos. **Objetivo:** interpretar o resultado principal, antes de apresentar os próximos passos.

**Fala sugerida:**

“Entregamos um artefato reutilizável e uma avaliação reproduzível. Nas simulações, a heurística principal melhorou a resposta às prioridades e reduziu o atraso controlável frente ao vizinho próximo. A distância média ficou próxima, mas aumentou em diversos cenários, e o custo computacional foi maior. Os resultados favorecem o objetivo temporal nas condições avaliadas, com uma vantagem que depende do cenário. Essa é a conclusão sustentada pelo estudo.”

**Detalhes para dominar:** o ganho territorial médio foi de 6,02 pontos percentuais em resposta pronta; no fatorial, 6,64. Esses são estudos distintos. Não repetir todos os números nem declarar superioridade universal, ótimo global ou benefício clínico observado. A conclusão resume a interpretação; o slide seguinte apresenta trabalhos futuros. O agradecimento ocorre somente no último slide.

**Transição:** “Esses resultados indicam o que precisa ser avaliado na continuidade do trabalho.”

## Slide 19 - Trabalhos futuros

**Tempo:** 50-70 segundos. **Objetivo:** apresentar extensões concretas e coerentes com o que já foi implementado.

**Fala sugerida:**

“O primeiro passo é repetir a avaliação com distâncias e tempos pelas ruas. A integração OSRM já está na aplicação; falta medir como ela muda as decisões e os resultados dos experimentos. Depois precisamos de demanda e jornadas observadas e de um piloto com equipes. Para generalizar, devemos ampliar sementes, territórios e condições com múltiplas equipes. Na parte metodológica, queremos variar os pesos da busca, retirar etapas para medir sua contribuição, calcular compromissos de Pareto e comparar instâncias pequenas com uma referência exata.”

**Aprofundamento, se houver tempo:**

- **Ruas:** manter os mesmos cenários ao substituir Haversine por matriz OSRM com perfil `foot.lua`; medir aumento de custo, mudanças de jornada, cobertura e atraso. Não usar um perfil de carro como se fosse caminhada.
- **Campo:** calibrar duração, intervalos, prioridade e ausências com observações; avaliar utilidade do plano, correções humanas e condições de execução. A proposta não inclui uma coleta já realizada ou um benefício já medido.
- **Generalização:** repetir o fatorial em outros polígonos, aumentar repetições e variar número, disponibilidade e capacidade das equipes; avaliar também cenários escassos.
- **Método:** testar os pesos 12 e 24, ablações da busca econômica e do reparo, e conjuntos de soluções não dominadas. Uma referência exata pequena permite estimar qualidade e custo sem prometer resolver exatamente todas as instâncias.

Pareto, referência exata e ablações são propostas futuras, não resultados concluídos. Não anunciar apenas “integrar OSRM” ou “fazer sensibilidade”: já existe integração, e a sensibilidade fatorial já foi executada. A extensão é aprofundar essas avaliações.

**Transição:** “Estas são as referências que fundamentaram o trabalho e a fonte dos dados territoriais.”

## Slide 20 - Referências

**Tempo:** 10-15 segundos. **Objetivo:** apresentar todas as oito referências bibliográficas usadas no projeto e identificar a fonte territorial.

**Fala sugerida:**

“Aqui estão as oito referências que fundamentaram a formulação e as decisões do projeto. Os territórios e unidades usados nos cenários vêm da base GeoSaúde de Porto Alegre. Os fichamentos, a proveniência dos dados e os procedimentos de reprodução estão documentados no repositório.”

**Detalhes para dominar:** não ler os oito títulos. A bibliografia reúne fundamentos e organização da APS, territorialização, coordenação de redes, informação para gestão, TIC e roteamento em saúde. Matta e Morosini estão indicados como sem data porque o fichamento não informa um ano; não inventar essa informação. GeoSaúde é fonte cartográfica, não fonte de pacientes reais. Não inserir resultados do próprio projeto como se fossem achados das referências.

**Transição:** passar ao agradecimento, sem retomar a conclusão.

## Slide 21 - Agradecimento

**Tempo:** 5-10 segundos. **Objetivo:** encerrar a fala.

**Fala sugerida:** “Obrigado pela atenção.”

**Orientação:** o slide contém apenas o agradecimento. Manter essa tela no fim; abrir `apoio.tex` quando uma questão precisar de uma tabela ou definição complementar. Não acrescentar “Perguntas?” à conclusão.

## Slides de apoio - arquivo separado

### Apoio 1 - avaliação piloto de 01/10

**Quando usar:** pergunta sobre evolução, resultados antigos ou motivação da revisão.

**Fala detalhada:**

“Esta é a avaliação histórica de onze cenários. Tivemos 33 planos estáticos, um por método e cenário, e 132 simulações dinâmicas nas quatro taxas de falha do piloto. No benchmark estático, a principal teve cobertura média de 100%, atraso acumulado médio de 116,91 dias e distância de 90,59 km. A urgência teve 99,09%, 120,64 dias e 103,68 km; o vizinho teve 100%, 114,36 dias e 62,61 km. Portanto o piloto não autorizava afirmar que a principal dominava as alternativas. Essa constatação motivou a revisão do método e do desenho experimental.”

**Explicação importante:** 116,91 é média de uma **soma de atrasos por cenário**, não média ponderada de atraso controlável de 116 dias por paciente. Não colocar esse número ao lado dos 2,18 dias da avaliação final como se fossem a mesma métrica. Também mudou a implementação. Não calcular uma porcentagem de “melhora entre versões” usando protocolos diferentes.

O piloto contempla capacidade folgada, equilibrada e escassa, diferentes tamanhos e casos-limite. Os registros de integridade daquele protocolo não tinham valores nulos ou `NaN`. Isso é checagem de consistência numérica, não validação externa do modelo.

### Apoio 2 - validação da heurística revista

**Quando usar:** pergunta sobre avaliação fora das sementes principais ou comparação com a versão anterior.

**Fala detalhada:**

“Também comparamos a implementação atual com o commit anterior 423e6d4. Foram 36 instâncias construídas a partir da Restinga e CF Santa Marta, três sementes separadas e seis combinações de fatores. A cobertura planejada cresceu em média 0,346 ponto percentual e a resposta pronta, 0,724 ponto. Houve cinco vitórias e 31 empates nesses indicadores. O atraso controlável diminuiu cerca de 0,014 dia, enquanto a distância cresceu aproximadamente 0,392 km. Esse resultado mostra ganhos modestos de atendimento que podem exigir deslocamento adicional.”

**Aprofundamento:** as sementes são 20261101, 20261102 e 20261103; são rótulos numéricos de PRNG, não datas de coleta. Esta validação compara planos iniciais, usa Haversine e não simula ausências. Estar fora das sementes principais ajuda a não olhar só para a grade usada na análise anterior, mas não transforma a validação em um estudo clínico independente. Escalas de área diferentes de 1× continuam sintéticas.

Na distância, a tabela mostra aumento físico de +0,392 km. A tabela de origem usa “ganho” como baseline menos atual e por isso registra -0,392. São o mesmo resultado com convenções de sinal diferentes. As contagens 4/27/5 referem-se a melhor, igual e pior distância, não ao sinal positivo impresso nesta versão resumida.

### Apoio 3 - protocolo e função de busca

**Quando usar:** pergunta sobre níveis, contagens, pesos, orçamento ou funcionamento preciso da busca.

**Fala detalhada:**

“A grade tem três níveis de pacientes, área, horizonte, vencimento inicial e probabilidade de falha. São 243 instâncias de cenário quando incluímos as três sementes nos quatro fatores que precedem a falha; as três taxas e os três métodos levam a 2.187 simulações. A função de busca combina tempo de viagem com atraso controlável ponderado e pontos de prioridade respondidos prontamente. O coeficiente de atraso é 12; o de prontidão é zero na fase econômica e 24 na fase posterior. São minutos equivalentes de preferência na busca.”

**Definição precisa:** `D_w` representa soma de peso de prioridade vezes dias controláveis de atraso para as visitas consideradas nas mudanças de rota. `P_pronta` representa soma dos pontos de prioridade pronta, não o percentual exibido nos resultados. `T_viagem` é o tempo calculado pela matriz. O algoritmo avalia diferenças dessa função entre estados sujeitos a capacidade, antecipação, duplicidade e orçamento, em vez de resolver um programa exato global.

O reparo de pendências também usa regras de inserção e substituição; a função resumida no slide não descreve sozinha toda a heurística. O limite de 80 movimentos é por busca entre rotas. O 1.5-opt tem seu próprio critério de parada por ausência de melhora. Não dizer que a heurística inteira executa exatamente 80 passos.

Se perguntarem por complexidade: a matriz tem dimensão do posto mais pacientes; as buscas percorrem opções de rotas, posições e trocas. O limite de movimentos limita a repetição, mas o projeto ainda precisa de um experimento sistemático de escala. Não anunciar uma classe assintótica completa sem derivá-la para a implementação.

### Apoio 4 - referências e reprodução

**Quando usar:** pergunta sobre fontes, dados ou como repetir a avaliação.

**Fala sugerida:**

“As referências principais estão resumidas aqui, e a bibliografia completa está no roteiro e nos fichamentos. O repositório contém o núcleo, os cenários, os protocolos, as sementes e os geradores de relatório. A síntese territorial e o fatorial podem ser regenerados pelos comandos indicados, depois da compilação e, no fatorial, da simulação. As saídas por execução ficam em CSV e JSON; os relatórios permitem explorar médias, dispersão e comparações pareadas.”

**Detalhes de reprodução:** a síntese de Porto Alegre chama as simulações e gera resultados; o comando `factorial:report` lê os resultados já gerados e não substitui a execução de `factorial`. Para comparar tempos, usar os resultados da mesma máquina e rodada. Os números de tempo registrados nos slides não precisam permanecer idênticos em outra execução. A fonte GeoSaúde e seus hashes estão documentados na proveniência. Os resultados brutos são regeneráveis; nem todos são versionados no Git.

## Respostas preparadas para perguntas prováveis

**“Por que a resposta pronta é baixa se a cobertura é quase 100%?”** Cobertura considera se a demanda inicial foi concluída em algum momento da janela. Resposta pronta considera prioridade e momento: demanda vencida precisa ser atendida no primeiro dia, e a futura até seu prazo. Um método pode atender quase todos no fim do mês e ainda responder tardiamente a muitas prioridades.

**“São dados reais?”** Os polígonos e localizações das unidades vêm do GeoSaúde. Pacientes, condições, pesos, prazos e ausências são sintéticos. Não houve avaliação com prontuários ou pessoas identificáveis.

**“Vocês já usam rotas pelas ruas?”** A aplicação tem integração OSRM para matriz e desenho de rotas com perfil de caminhada, quando o servidor está configurado. Os resultados apresentados foram calculados com Haversine. O estudo comparativo com matriz viária é futuro.

**“A principal sempre anda menos?”** Não. A média territorial foi 1,1% menor que o vizinho, mas a distância foi maior em 163 dos 396 pares. No fatorial houve 334 derrotas em distância; com 10% de falha, a média foi 0,25 km maior.

**“Isso prova a hipótese?”** Dá evidência descritiva favorável à resposta temporal nas condições simuladas. Não prova generalização, equivalência estatística de distância, optimalidade nem benefício clínico real.

**“As estratégias sofreram as mesmas faltas?”** Usam o mesmo sorteio para um paciente na mesma data e limiares aninhados por taxa. Como podem visitar em dias diferentes, as falhas realizadas e o número de tentativas podem diferir. Esse controle evita sorteios diferentes para uma tentativa idêntica.

**“O ganho vem só do 1.5-opt?”** Não é possível afirmar isso. Ele também está habilitado nos baselines. Os resultados comparam estratégias completas. Uma ablação futura deve retirar separadamente etapas para medir sua contribuição.

**“Por que não usar um solver exato?”** O projeto priorizou um núcleo simples, reutilizável e capaz de replanejar, com heurísticas comparáveis. Não mostramos uma comparação com ótimo global. Uma referência exata em pequenas instâncias ajudará a quantificar a qualidade da solução.

**“Por que uma equipe se a aplicação aceita várias?”** Foi um controle experimental para comparar estratégias mantendo a mesma capacidade. A capacidade de representar várias equipes no código não substitui a avaliação experimental desse caso.

**“Qual é a contribuição do trabalho?”** A combinação de modelagem temporal, núcleo compartilhado, aplicação com histórico e exportação, comparação reproduzível, dados territoriais com proveniência e análise de limites. Não reivindicar invenção do vizinho próximo, 2-opt ou do roteamento em saúde.

## Versão de exposição em 12 minutos

Passar rapidamente por literatura (4), entregas (5) e arquitetura (7). Dedicar mais tempo à hipótese (3), à heurística (10), ao replanejamento (11), ao protocolo (12) e aos resultados (13-16). Explicar resposta pronta oralmente ao introduzir o gráfico do slide 13. Manter limitações (17), conclusão (18), trabalhos futuros (19), referências (20) e agradecimento (21). Os quatro slides de `apoio.tex` ficam reservados à discussão.

## Fontes do conteúdo e rastreabilidade

As falas descrevem a implementação final consultada em 08/10/2026. Onde documentos de planejamento e código divergem, o roteiro descreve o código ao explicar a versão implementada e preserva a proposta original apenas como história.

| Slides | Evidência no repositório | O que sustenta |
|---|---|---|
| 1-3 | [README](../../README.md), [projeto de pesquisa](../../projeto_de_pesquisa/projeto_de_pesquisa.md) | Problema e hipótese |
| 4, 20 | [Fichamentos](../../papers/_papers.md), [artefatos da literatura](../../papers/artifacts.md) | Oito trabalhos e decisões |
| 5 | [Diário](../../lab_notebook.md), [artefato](../../artefato/README.md), [experimentos](../../experimentos/README.md) | Entregas realizadas |
| 6-11 | [Núcleo](../../artefato/packages/core/src/index.ts), [demanda](../../artefato/packages/core/src/demand/index.ts), [documentação](../../artefato/README.md) | Calendário, estado, arquitetura e métodos |
| 8 | [Cenário Restinga](../../experimentos/cenarios/geosaude_us_restinga_20261106_30.json) | Contorno, amostra e rota ilustrada |
| 9-10; apoio 3 | [Principal](../../artefato/packages/core/src/strategies/main-heuristic.ts), [urgência](../../artefato/packages/core/src/strategies/baseline-urgency.ts), [vizinho](../../artefato/packages/core/src/strategies/baseline-nearest.ts), [1.5-opt](../../artefato/packages/core/src/improvement/one-half-opt.ts) | Implementação das estratégias |
| 11-15 | [Simulador](../../experimentos/src/simulador/simulador-dinamico.ts), [métricas](../../artefato/packages/core/src/metrics/index.ts) | Ausências, denominadores e resposta pronta |
| 12-15 | [Síntese territorial](../../experimentos/analise/porto-alegre/resumo-slides.md) | 1.188 simulações e resultados de Porto Alegre |
| 12, 16; apoio 3 | [Protocolo fatorial](../../experimentos/PROTOCOLO_FATORIAL.md), [resumo](../../experimentos/analise/fatorial/resumo.md) | 2.187 simulações e sensibilidade |
| Apoio 1-2 | [Piloto](../../experimentos/analise/protocolo_final_2026-10-01.md), [validação](../../experimentos/analise/fatorial/validacao-versoes.md) | Protocolos históricos e comparação de versões |
| 17-19 | Protocolos, resultados e [matriz viária](../../artefato/packages/server/src/routes/road-matrix.ts) | Limites e próximos passos |

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

Executar da raiz do repositório, com as dependências já instaladas:

```powershell
npm run build --prefix artefato/packages/core
npm run build --prefix experimentos
npm run citywide:report --prefix experimentos
npm run factorial --prefix experimentos
npm run factorial:report --prefix experimentos
npm run factorial:validate --prefix experimentos
```

`citywide:report` regenera a simulação territorial e sua síntese; `factorial` executa a grade; `factorial:report` produz a análise dessa grade; `factorial:validate` compara versões. A documentação registra as dependências e os requisitos de cada etapa. Os comandos de reprodução não significam que os resultados em ruas já foram avaliados.
