# Como funciona o algoritmo de planejamento do projeto

Este documento explica a implementação atual do núcleo `@routing/core`, com exemplos numéricos. Ele complementa a apresentação: os detalhes de 1.5-opt e das decisões de busca ficam aqui, sem exigir um slide para cada operação. Os exemplos são didáticos e não são resultados dos experimentos de Porto Alegre ou da Restinga.

O algoritmo resolve quatro decisões relacionadas: quais pacientes atender, em que dia, com qual equipe e em que ordem. A heurística principal usa uma construção geográfica, duas buscas entre rotas e um reparo de pendências. Dentro das rotas, usa 1.5-opt para melhorar a ordem das visitas. É uma heurística: não calcula nem demonstra o ótimo global.

## 1. Entradas, saídas e termos

A entrada é um `Scenario`. Ele contém a unidade de saúde, seus territórios, pacientes, condições de acompanhamento, equipes, jornadas, disponibilidades, início do planejamento, horizonte e antecipação máxima. Uma condição tem peso de prioridade, intervalo máximo de acompanhamento e última visita ou prazo inicial. O paciente também tem coordenadas e duração de atendimento.

A saída é um `Plan`, com uma rota por equipe e dia, visitas ordenadas, custos e horários estimados, visitas não alocadas e métricas. As não alocadas são explicitadas; não desaparecem por falta de capacidade.

| Termo | Significado na implementação |
|---|---|
| Unidade ou U | Ponto de saída e retorno de cada rota |
| Candidata | Uma necessidade de visita gerada para um paciente e uma condição principal |
| Rota | Visitas de uma equipe em um dia, incluindo saída e retorno à unidade |
| Jornada | Tempo máximo de deslocamento mais atendimento nessa rota |
| Peso clínico `w` | Importância relativa configurada para a condição |
| Índice de urgência `s` | Combinação de atraso inicial e peso, usada para ordenar candidatos |
| Resposta pronta | Atendimento sem atraso controlável, ponderado pelo peso clínico |

Peso clínico, índice de urgência e resposta pronta são conceitos distintos. O peso é um parâmetro da condição; o índice serve à ordenação; a resposta pronta é uma medida de atendimento. Nenhum dos três representa um desfecho clínico observado.

## 2. Pipeline público do núcleo

`planScenario(scenario, options)` executa a sequência abaixo:

1. Valida os dados do cenário e identifica pacientes elegíveis no território.
2. Gera a demanda e as datas úteis da janela.
3. Constrói a matriz de distâncias e tempos ou valida a matriz externa recebida.
4. Seleciona urgência, vizinho próximo ou heurística principal.
5. Executa a estratégia escolhida.
6. Aplica a passagem final de 1.5-opt quando habilitada.
7. Calcula métricas e monta o plano.
8. Executa `verifyPlan`; se houver violação das restrições verificadas, lança um erro.

O verificador atual confere equipe existente, disponibilidade por data, jornada, território e repetição de paciente **dentro de cada rota**. Ele não prova optimalidade nem constitui uma prova global de todas as restrições possíveis. A geração de demanda e as estratégias também têm suas próprias verificações de elegibilidade.

## 3. De condições de saúde a candidatas de visita

### 3.1 Prazo de acompanhamento

Quando existe última visita, o prazo é:

\[
\text{prazo}=\text{última visita}+\text{intervalo máximo em dias corridos}.
\]

Se não há última visita, o núcleo usa `initialDueDate`. Se nenhum dos dois foi informado, considera o início da janela como prazo.

Exemplo: uma condição atendida em 05/09/2026 com intervalo de 30 dias tem prazo em 05/10/2026. Se o planejamento começa em 05/10, a visita é devida nesse dia. Se começa em 07/10, já existem dois dias de atraso.

### 3.2 Uma condição principal por paciente

O gerador calcula os prazos de todas as condições, ordena pelo prazo mais antigo e, em caso de igualdade, pelo maior índice de urgência. A condição escolhida representa a candidata do paciente nessa chamada de planejamento. Não gera uma candidata separada para cada condição simultaneamente.

Exemplo: Ana tem uma condição com prazo em 05/10 e outra em 09/10. A primeira representa sua visita. Se ambas vencem em 05/10, a de maior índice de urgência vence o desempate. O registro de conclusão atualiza a condição identificada no resultado; não se deve presumir que todas as condições foram atualizadas.

### 3.3 Horizonte e antecipação

`N` conta **dias úteis**, enquanto os intervalos de acompanhamento e `A` contam **dias corridos**. O núcleo gera os próximos N dias úteis a partir do início. A demanda inclui prazos até o último dia útil mais A, além de visitas já vencidas.

Com início na segunda-feira 05/10/2026, N = 5 e A = 2, a janela útil termina em 09/10. Um prazo em 11/10 pode entrar na demanda porque está até dois dias corridos depois desse fim. Porém, ser candidata não significa poder ser marcada em qualquer dia: a principal só permite antecipação que respeite A na data de destino. Os baselines, na construção atual, aguardam o prazo chegar.

O calendário do núcleo identifica dias úteis pelas suas rotinas; não há uma integração automática com calendários oficiais de feriados.

### 3.4 O índice usado pela urgência

O código calcula uma vez, no início da chamada:

\[
s=10\times\text{dias de atraso no início}+5\times w.
\]

| Paciente | Atraso inicial | Peso da condição | Índice |
|---|---:|---:|---:|
| Ana | 3 dias | 2 | 40 |
| Bruno | 0 dias | 5 | 25 |
| Carla | 1 dia | 1 | 15 |

A ordem por urgência é Ana, Bruno, Carla, considerando as candidatas elegíveis na data. Isso torna a descrição “atraso acumulado e necessidade clínica” mais informativa do que apenas “maior pontuação”. Na fórmula, um dia de atraso acrescenta 10 e uma unidade de peso acrescenta 5. Os coeficientes são parâmetros da implementação, não uma escala clínica validada.

O índice não é recalculado a cada dia dentro da mesma construção. Uma nova chamada de planejamento, após avançar o início da janela, gera novos índices.

## 4. Matriz de custos e jornada

A matriz tem a unidade no índice zero e, depois, os pacientes elegíveis. Uma célula informa distância e tempo de um ponto a outro. Por padrão, a distância usa Haversine, e o tempo é:

\[
t_{ij}=\frac{d_{ij}}{v}\times60.
\]

Um trecho de 1,5 km a 4,5 km/h leva 20 minutos. A matriz externa pode representar trajetos viários; deve ter a mesma ordem de nós, dimensões corretas e valores finitos não negativos. A integração com OSRM existe na aplicação, mas os resultados apresentados usam Haversine.

Para a sequência `U → A → B → U`, o tempo de trabalho é:

\[
t_{UA}+\text{atendimento de A}+t_{AB}+\text{atendimento de B}+t_{BU}.
\]

Suponha deslocamentos de 10, 8 e 12 minutos, e atendimentos de 30 minutos cada. A rota ocupa 90 minutos, incluindo o retorno. Com jornada de 100 minutos, acrescentar uma visita exige recalcular o percurso e sua duração; os 10 minutos livres não bastam para um atendimento de 30 minutos.

## 5. Os dois baselines

### 5.1 Urgência

A estratégia percorre dias e equipes disponíveis na ordem do cenário. Para cada equipe, considera candidatas ainda não alocadas cujo prazo já chegou. Ordena-as pelo índice de urgência e tenta acrescentá-las ao fim da rota. A inserção só é aceita se deslocamento, atendimento e retorno couberem na jornada. Uma visita que não cabe pode ser seguida por outra que cabe.

O comportamento efetivo vem do código: ele não faz uma busca global da equipe de menor custo para cada paciente, apesar de alguns comentários históricos descreverem essa ideia. Também não ordena estritamente só pela data do prazo; usa o índice que combina atraso inicial e peso.

### 5.2 Vizinho próximo

Parte da unidade. Entre candidatas devidas e ainda não alocadas, escolhe a viável com menor **tempo de deslocamento a partir da posição atual**. Repete até que nenhuma candidata caiba, incluindo o retorno. Depois passa à próxima equipe ou data.

Exemplo: há três candidatas a 5, 12 e 8 minutos da unidade. Se todas cabem, começa pela de 5 minutos. Após atendê-la, recalcula a proximidade a partir dessa casa; não continua usando a distância da unidade. Uma candidata próxima cujo atendimento e retorno excedam a jornada é descartada nessa seleção.

Na construção atual, ambos os baselines exigem `prazo ≤ dia` e não usam A para adiantar visitas futuras. A principal pode antecipá-las em suas etapas seguintes. As três estratégias recebem o mesmo cenário; essa diferença faz parte do método comparado.

## 6. A heurística principal completa

A sequência implementada é:

```text
Construção pelo vizinho próximo
    ↓
Busca econômica entre rotas, sem recuperar pendências
    ↓
Inserção de pendências + busca com incentivo à resposta pronta
    ↓
Substituição por prioridades maiores, quando admissível
    ↓
Nova tentativa de inserir pendências
    ↓
Passagem final de 1.5-opt, métricas e verificação
```

As duas buscas chamam a mesma rotina com parâmetros diferentes. A primeira usa `recoverPending = false` e peso de resposta pronta igual a zero. A segunda usa `recoverPending = true` e peso igual a 24.

Cada fase começa reconstruindo horários e custos das rotas e executando 1.5-opt. Na segunda, a primeira tentativa de inserir pendências acontece **antes** de fixar seus orçamentos de deslocamento. Esse detalhe explica por que recuperar mais atendimentos pode aumentar o percurso em relação à semente geográfica.

## 7. Atraso controlável e resposta pronta

O atraso controlável de uma visita em uma data d é:

\[
a(d)=\max(0,d-\max(\text{início da janela},\text{prazo})).
\]

A diferença é em dias corridos. Para uma visita já vencida, conta o tempo adicional a partir do início; para uma futura, conta o tempo após o prazo. Isso evita tratar o atraso herdado antes do planejamento como se tivesse sido produzido integralmente pelo algoritmo.

Com início em 05/10:

| Prazo | Atendimento | Atraso convencional | Atraso controlável | Resposta pronta? |
|---|---|---:|---:|---|
| 02/10 | 05/10 | 3 | 0 | Sim |
| 02/10 | 06/10 | 4 | 1 | Não |
| 07/10 | 07/10 | 0 | 0 | Sim |
| 07/10 | 09/10 | 2 | 2 | Não |

A soma ponderada de atraso é `D_w = Σ w × a`. Os pontos de resposta pronta são `P = Σ w` para as visitas atendidas com a = 0. Nas rotinas da principal e de métricas, o peso usado tem piso 1.

Se a demanda inicial tem pesos 4, 2 e 1, e apenas as duas últimas visitas são prontas, a resposta pronta ponderada é `3/7 × 100 = 42,86%`. Atender depois a primeira pode elevar cobertura, mas não a torna pronta retroativamente. O denominador é a prioridade da demanda completa, não só dos atendidos.

Na busca entre rotas, P conta pontos nas rotas agendadas. A avaliação dinâmica dos experimentos mede conclusões efetivas da demanda inicial. Plano e execução precisam ser distinguidos, especialmente quando há ausências.

## 8. Busca entre rotas: mover ou trocar

### 8.1 Transferência de uma visita

O algoritmo retira uma visita de uma rota e testa inseri-la em todas as posições de outra. A outra rota pode pertencer a outro dia, outra equipe ou ambos. Cada alternativa é recusada se exceder a jornada de destino, adiantar além de A, repetir o paciente no destino ou violar os orçamentos da fase.

### 8.2 Troca de duas visitas

Quando duas jornadas estão cheias, uma transferência pode ser impossível. A troca substitui uma visita de cada rota pela outra, preservando o número de visitas por rota. A duração dos atendimentos pode mudar, por isso as duas jornadas são recalculadas. A troca também verifica antecipação e duplicidade nas duas direções.

Exemplo: uma visita de peso 4 está em 06/10 e uma de peso 1 em 05/10. Ambas vencem em 05/10 e têm a mesma duração. Trocá-las faz a prioridade maior ser pronta e adia a menor em um dia. O atraso ponderado muda de 4 para 1, e os pontos prontos mudam de 1 para 4. A troca só pode ser aceita se os trajetos e jornadas também passarem pelos limites.

### 8.3 Objetivo usado para escolher uma melhora

As alternativas são avaliadas pela variação de:

\[
J=T_{viagem}+12D_w-\lambda P,
\]

com λ = 0 na primeira busca e λ = 24 na segunda. Uma alternativa precisa ter variação de J menor que `−0,0001`. Entre as transferências e trocas admissíveis, a rotina escolhe a de melhor variação encontrada na varredura.

No exemplo da troca acima, se o deslocamento total também cai um minuto, temos `ΔT = −1`, `ΔD_w = −3` e `ΔP = +3`. A variação é `−37` na primeira busca e `−109` na segunda. Os números representam minutos equivalentes de decisão; não são minutos de atendimento efetivamente economizados nem valores clínicos medidos.

### 8.4 Orçamentos e parada

Cada fase guarda o tempo total de viagem, a distância total e os pontos prontos de seu estado inicial. As transferências e trocas não podem exceder esses orçamentos de tempo e distância, nem reduzir os pontos prontos abaixo do valor inicial da fase. Isso não exige melhora estrita em todos os indicadores a cada movimento: pode haver uma pequena piora em relação ao movimento anterior, desde que permaneça dentro do orçamento de entrada e melhore J.

Após aceitar um movimento, a rotina reconstrói e otimiza as duas rotas afetadas. Cada busca aceita no máximo **80 movimentos**, ou para antes se não houver melhora admissível. São dois limites de 80, um por fase; o 1.5-opt tem seu próprio critério de parada.

## 9. Recuperação de visitas pendentes

### 9.1 Inserção nos espaços disponíveis

Na segunda fase, a rotina ordena pendências por peso clínico decrescente; no desempate inicial, por prazo e identificador. Para cada candidata, testa posições em todas as rotas existentes, inclusive rotas vazias. Respeita jornada, antecipação e duplicidade. A alternativa escolhida minimiza:

\[
\text{acréscimo de viagem}+12\times w\times a(d).
\]

Exemplo: uma pendência de peso 4 e duração de 30 minutos vence em 05/10. Uma inserção em 05/10 acrescenta 14 minutos de viagem e tem atraso controlável zero: custo 14. Outra em 06/10 acrescenta 8 minutos, mas tem atraso de um dia: custo `8 + 12 × 4 = 56`. Se ambas são viáveis, escolhe 05/10.

Se a rota de 05/10 antes tinha 30 minutos de viagem e 150 de atendimento, passa a `30 + 14 + 150 + 30 = 224` minutos. Cabe em uma jornada de 240. O custo de viagem aumentou porque houve um atendimento adicional; isso não contradiz a proteção dos movimentos entre rotas. O orçamento da segunda busca é fixado depois dessa primeira inserção.

### 9.2 Substituição quando a capacidade está cheia

Se restam pendências, uma visita mais prioritária pode substituir uma menos prioritária. O código exige peso estritamente maior, capacidade, antecipação e duplicidade válidas, proteção de pontos prontos, ausência de aumento do atraso ponderado estimado e respeito aos orçamentos de viagem e distância. A estimativa de atraso considera a pendência até o último dia útil da janela.

Exemplo: início em 05/10 e último dia em 09/10. Há uma pendência de peso 4 e uma visita de peso 1 marcada em 06/10; ambas vencem em 05/10. Ao substituir a visita agendada pela pendência, o atraso ponderado estimado da mais importante cai de `4 × 4 = 16` para `4 × 1 = 4`; o da deslocada cresce de 1 para 4. A variação conjunta é `−12 + 3 = −9`. Ambas seguem sem resposta pronta, logo sua mudança em pontos prontos é zero. Ainda faltam passar as verificações de percurso e jornada.

A escolha entre substituições admissíveis usa um critério próprio: `100 × diferença de pesos + 24 × mudança de pontos prontos − mudança de viagem`. A visita deslocada volta à lista de não alocadas com um motivo explícito. Substituir não significa concluir ou apagar a visita deslocada.

Depois das movimentações e substituições, a rotina tenta inserir pendências novamente. Esse reparo final também pode aproveitar capacidade aberta pela reorganização.

### 9.3 Proteção contra regressão por arredondamento

As rotas exibem tempo arredondado a uma casa e distância a duas. Ao final de uma fase, se a soma exibida piora em relação ao início **e o número de pendências permanece igual**, a rotina devolve o estado inicial salvo. Se a cobertura aumentou, essa condição de retorno não se aplica. Essa proteção adicional não é uma garantia universal de menor distância final que o vizinho próximo.

## 10. 1.5-opt dentro de cada rota

### 10.1 O que ele modifica

O 1.5-opt muda a **ordem** das mesmas visitas de uma rota. Não muda equipe, dia, conjunto de pacientes nem duração de atendimento. Combina reinserção de uma visita e inversão de subsegmentos. O nome usado no projeto identifica essa combinação; não deve ser explicado apenas como 2-opt.

A implementação minimiza o tempo total de trabalho da sequência, incluindo saída, atendimentos e retorno. Como o conjunto de atendimentos é fixo, sua soma é constante: melhorar esse valor equivale a diminuir o tempo de viagem. Em Haversine com velocidade constante, distância e tempo são proporcionais. Para uma matriz externa, a função decide pelo **tempo**; não exige separadamente redução de quilômetros.

### 10.2 Reinserção de um nó, com contas

Considere U, A, B, C e D sobre uma linha, nas posições 0, 1, 4, 2 e 3. Cada unidade de distância leva 10 minutos. Cada visita dura 20 minutos.

| De / para | U | A | B | C | D |
|---|---:|---:|---:|---:|---:|
| U | 0 | 10 | 40 | 20 | 30 |
| A | 10 | 0 | 30 | 10 | 20 |
| B | 40 | 30 | 0 | 20 | 10 |
| C | 20 | 10 | 20 | 0 | 10 |
| D | 30 | 20 | 10 | 10 | 0 |

A sequência `U → A → B → C → D → U` tem viagem de `10 + 30 + 20 + 10 + 30 = 100` minutos. Com quatro atendimentos, ocupa 180 minutos.

Retirar B e reinseri-lo depois de C produz `U → A → C → B → D → U`. A viagem passa a `10 + 10 + 20 + 10 + 30 = 80`, e o trabalho a 160. O conjunto de visitas não mudou. A melhora de 20 minutos libera tempo na rota; a inserção de uma nova visita, se houver, pertence a outra etapa.

### 10.3 Inversão de um trecho, com contas

Considere os vértices de um quadrado: U = (0,0), A = (0,1), B = (1,0) e C = (1,1). Os custos são distâncias euclidianas multiplicadas por 10 minutos. Lados levam 10 e diagonais aproximadamente 14,142 minutos.

Em `U → A → B → C → U`, a viagem é `10 + 14,142 + 10 + 14,142 = 48,284`. Inverter o trecho `[B, C]` gera `U → A → C → B → U`: quatro lados de 10, total 40. É uma inversão de subsegmento que melhora o tempo em aproximadamente 8,284 minutos.

Esse exemplo explica a operação isolada. A reinserção de um nó pode encontrar a mesma sequência antes; a rotina real tenta reinserções primeiro. Não se deve afirmar que ela necessariamente chegará à segunda operação nesse caso.

### 10.4 Ordem de busca e critério de parada

1. Percorre cada visita e posição de reinserção.
2. Aceita a primeira alternativa que reduz o tempo em mais de `0,0001` minuto e reinicia a busca.
3. Se nenhuma reinserção melhora, percorre possíveis inversões de subsegmentos.
4. Aceita a primeira inversão que melhora e reinicia pelas reinserções.
5. Para quando as duas famílias de movimentos não encontram melhora estrita.

Essa busca usa **primeira melhora**, diferentemente da varredura entre rotas, que guarda a melhor alternativa admissível encontrada. Empates não são aceitos. O resultado é um ótimo local para as operações testadas; outras permutações podem ser melhores.

Rotas com duas visitas ou menos são devolvidas diretamente pela função atual. Em matrizes simétricas, inverter duas visitas mantém o custo de ida e volta; em matrizes assimétricas, a função continua usando esse retorno antecipado, portanto não explora essa alternativa.

Depois de otimizar, recalcula trechos, distância, tempos de viagem, serviço e trabalho e horários de cada visita. O relógio estimado começa às 08h e é atualizado com viagem mais serviço; não há otimização de horários individuais de disponibilidade dos pacientes nesse modelo.

Exemplo: um trecho inicial de 10 minutos e atendimento de 20 produzem início às 08h10 e fim às 08h30. Se o próximo trecho leva 10 minutos, a próxima visita começa às 08h40. O retorno entra nos totais da rota, embora não seja uma visita.

### 10.5 Onde a função é chamada

A passagem pública final é habilitada por padrão; pode ser desabilitada por `enable1_5Opt = false` ou pela opção legada `enable2Opt = false`. Entretanto, a heurística principal também chama 1.5-opt internamente na construção de suas fases e após mudanças. Desabilitar apenas a passagem pública final não elimina essas chamadas internas. Nos experimentos apresentados, a passagem final está habilitada nas três estratégias.

## 11. Execução, ausência e replanejamento

Gerar um plano não conclui visitas. `applyVisitResults` recebe resultados `completed` ou `missed`:

- `completed` atualiza a última visita da condição indicada, incrementa a versão do cenário e entra no histórico.
- `missed` entra no histórico e na nova versão, mas não atualiza a última visita. Seu prazo original permanece válido.

Exemplo: prazo em 05/10, tentativa em 05/10 e paciente ausente. O resultado é `missed`; em 06/10, a visita continua devida, com o prazo de 05/10. Se ela for concluída em 06/10 e o intervalo for 30 dias, o novo prazo passa a 05/11. Registrar a ausência como conclusão adiaria indevidamente a necessidade.

O chamador deve avançar o início da janela e pedir novo plano; `applyVisitResults` não decide sozinho a próxima data. Na bancada dinâmica, o simulador executa apenas as rotas do dia, aplica os resultados, avança para o próximo dia útil e planeja novamente. A distância de uma tentativa ausente continua contabilizada.

O histórico é preservado. Replanejar não significa reescrever o que ocorreu, nem garante que uma pendência caiba no dia seguinte. Ela concorre com as demais dentro da capacidade disponível.

## 12. O que o algoritmo garante e o que permanece em aberto

O núcleo gera planos e verifica suas restrições implementadas; não comprova ótimo global. As buscas limitam operações e podem parar em soluções locais. Mais prioridade atendida pode custar deslocamento adicional, sobretudo na recuperação de pendências. Isso é coerente com resultados em que a média melhora, mas alguns cenários têm distância maior.

As ponderações 10, 5, 12, 24 e 100 têm papéis diferentes: ordenação de demanda, objetivo de busca e critério de substituição. Não devem ser tratadas como uma única pontuação nem como parâmetros clínicos validados. Estudar pesos e retirar etapas em ablações permite avaliar suas contribuições.

A disponibilidade modelada é da equipe por data. O horizonte aceita várias equipes, mas os estudos finais controlam uma por território. Haversine não representa ruas, barreiras ou relevo. Os pacientes e ausências experimentais são sintéticos. Essas limitações motivam avaliação com rede viária, mais sementes, múltiplas equipes e dados observados.

As decisões de roteamento são reproduzíveis com os mesmos dados, matrizes e ordem de entrada. As amostras sintéticas usam sementes. Identificadores de planos e timestamps dependem do relógio e de geração de identificador; não se deve esperar igualdade literal desses campos em execuções diferentes.

## 13. Onde conferir a implementação

| Arquivo | Parte explicada |
|---|---|
| [index.ts](../../artefato/packages/core/src/index.ts) | Pipeline público, opções, resultados de visitas e verificação |
| [demand/index.ts](../../artefato/packages/core/src/demand/index.ts) | Prazo, condição principal e índice de urgência |
| [demand/dates.ts](../../artefato/packages/core/src/demand/dates.ts) | Dias úteis e diferenças em dias corridos |
| [baseline-urgency.ts](../../artefato/packages/core/src/strategies/baseline-urgency.ts) | Construção por urgência |
| [baseline-nearest.ts](../../artefato/packages/core/src/strategies/baseline-nearest.ts) | Construção geográfica |
| [main-heuristic.ts](../../artefato/packages/core/src/strategies/main-heuristic.ts) | Duas buscas, objetivos, orçamentos e reparos |
| [one-half-opt.ts](../../artefato/packages/core/src/improvement/one-half-opt.ts) | Reinserção e inversão intra-rota |
| [haversine.ts](../../artefato/packages/core/src/costs/haversine.ts) | Matriz padrão e conversão de distância para tempo |
| [metrics/index.ts](../../artefato/packages/core/src/metrics/index.ts) | Métricas do plano, prioridade e atraso |
| [verification/index.ts](../../artefato/packages/core/src/verification/index.ts) | Restrições verificadas |
| [simulador-dinamico.ts](../../experimentos/src/simulador/simulador-dinamico.ts) | Execução diária simulada e replanejamento |

## 14. Explicação oral curta do método

“Começamos com uma agenda construída pela proximidade. Primeiro reorganizamos visitas entre dias e equipes para economizar percurso e reduzir atraso ponderado. Depois tentamos recuperar pendências, valorizar prioridades atendidas prontamente e fazer substituições admissíveis. Dentro das rotas, o 1.5-opt melhora a ordem por reinserção de uma visita e inversão de trechos. Tudo precisa caber na jornada. Ao registrar uma ausência, preservamos a pendência e planejamos os dias futuros novamente. É uma heurística com critérios explícitos; os experimentos avaliam seus ganhos e custos.”
