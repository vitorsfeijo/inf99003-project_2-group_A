# Artefato Computacional — Roteamento de Visitas Domiciliares na APS

Framework em TypeScript para planejar e replanejar visitas domiciliares de equipes multiprofissionais da Atenção Primária à Saúde (APS), desenvolvido na disciplina INF99003. O planejamento distribui atendimentos em uma janela de **N dias úteis**, admite antecipação de até **A dias corridos**, considera território, disponibilidade e jornada das equipes e estima deslocamentos entre o posto e os pacientes.

A aplicação reúne um núcleo reutilizável (`@routing/core`), uma API com persistência SQLite e uma interface com mapa. A [bancada experimental](../experimentos/README.md) usa o mesmo núcleo para comparar métodos em cenários sintéticos e simular execução com falhas.

## Organização e arquitetura

```text
artefato/
├── AGENTS.md                  # Guia consolidado para manutenção
├── package.json               # Workspaces e build dos três pacotes
└── packages/
    ├── core/src/
    │   ├── index.ts           # API pública e orquestração do pipeline
    │   ├── types/             # Contratos de entrada, contexto e saída
    │   ├── validation/        # Validação básica e filtro territorial
    │   ├── demand/            # Calendário, prazos e candidatos
    │   ├── costs/             # Matrizes Haversine de distância e tempo
    │   ├── strategies/        # Main-heuristic e dois baselines
    │   ├── improvement/       # Melhoria intra-rota 1.5-opt
    │   ├── metrics/           # Indicadores do plano previsto
    │   ├── verification/     # Verificação das restrições implementadas
    │   └── example.ts        # Exemplo executável das três estratégias
    ├── server/src/            # Fastify, SQLite e exportadores CSV/GPX
    └── web/src/               # React, Vite e mapa Leaflet
```

```text
Interface React/Leaflet (:3000) → API Fastify (:3001) → @routing/core
                                       ↓
                              SQLite: cenários e planos

Interface em fallback local ──────────────────────→ @routing/core
Bancada experimental ─────────────────────────────→ @routing/core
```

O núcleo não depende de banco, servidor, navegador ou bibliotecas externas. Recebe objetos tipados e retorna um plano, sem persistir estado. Os identificadores e timestamps dos planos usam o relógio de execução; por isso, esses metadados variam entre chamadas mesmo quando as entradas e rotas são iguais.

## Instalação, compilação e execução

Requisitos: Node.js 20+ e npm. Os comandos desta seção partem da **raiz do repositório**, um nível acima de `artefato/`.

```bash
# Instalar as dependências dos workspaces
npm install --prefix artefato

# Compilar núcleo, backend e frontend
npm run build

# Compilar e iniciar backend e frontend juntos (prestart executa o build)
npm start
```

A interface fica em `http://localhost:3000` e a API em `http://localhost:3001/api`. Para executar separadamente, após compilar:

```bash
npm start --prefix artefato/packages/server
npm run dev --prefix artefato/packages/web
```

Para conferir cada pacote e executar o exemplo do núcleo:

```bash
npm run build --prefix artefato/packages/core
npm run build --prefix artefato/packages/server
npm run build --prefix artefato/packages/web
node artefato/packages/core/dist/example.js
```

O exemplo imprime planos e métricas das três estratégias. Ele captura erros e os imprime, portanto a ausência de um código de saída de erro não substitui a conferência da saída.

## Contratos e API do núcleo

Os tipos estão em [`packages/core/src/types/index.ts`](packages/core/src/types/index.ts) e são exportados pela entrada pública [`packages/core/src/index.ts`](packages/core/src/index.ts).

```typescript
planScenario(scenario: Scenario, options: PlanOptions): Plan
applyVisitResults(state: ScenarioState, results: VisitResult[]): ScenarioState
verifyPlan(scenario: Scenario, plan: Plan): VerificationResult
```

### Entrada: `Scenario`

| Campo | Papel no planejamento |
| --- | --- |
| `id`, `version` | Identificam o cenário e sua versão. |
| `healthCenter` | Posto de partida e retorno, com identificador e coordenadas. |
| `polygons` | Polígonos que delimitam a área de atendimento. |
| `patients` | Pacientes, coordenadas, duração do atendimento e condições clínicas. |
| `teams` | Equipes, jornada diária em minutos e datas disponíveis. |
| `startDate` | Data inicial em formato `YYYY-MM-DD`. |
| `planningHorizonDays` | N: quantidade de dias úteis gerados para o plano. |
| `maxAnticipationDays` | A: máximo de dias corridos antes do vencimento em que se pode atender. |
| `costParameters.travelSpeedKmh` | Velocidade média usada para converter distância em tempo. |

Cada condição registra `conditionId`, `maxIntervalDays`, `priorityWeight` e, quando disponível, `lastVisitDate` ou `initialDueDate`. A duração vem de `defaultVisitDurationMinutes` do paciente; o código usa 30 minutos quando o valor é ausente ou zero. `availableDays: []` significa disponibilidade em todos os dias úteis da janela.

### Opções e saída

`PlanOptions.strategyId` seleciona `main-heuristic`, `urgency-baseline` ou `nearest-baseline`. Embora o tipo exija esse campo, em execução um identificador ausente ou vazio usa `main-heuristic`. Um identificador desconhecido lança erro.

A melhoria 1.5-opt está habilitada por padrão. `enable1_5Opt: false` a desliga; a flag legada `enable2Opt: false` também a desliga. A regra efetiva exige que **nenhuma das duas flags seja `false`**.

O `Plan` contém os identificadores do cenário e da versão, estratégia, timestamp, `routes`, `unallocatedVisits` e `metrics`. Cada rota corresponde a um par data/equipe e registra visitas ordenadas e totais de distância, deslocamento, atendimento e jornada. Cada pendência registra o candidato, paciente, condição e motivo de não alocação.

## Pipeline completo de `planScenario`

A ordem abaixo corresponde à implementação atual, independentemente da numeração em comentários internos dos módulos.

```text
Scenario + PlanOptions
  → 1. Validar cenário e filtrar pacientes pelo território
  → 2. Gerar dias úteis e candidatos de visita
  → 3. Construir matrizes de distância e tempo
  → 4. Selecionar estratégia e montar PlanningContext
  → 5. Construir rotas e listar candidatos não alocados
  → 6. Aplicar 1.5-opt em cada rota, quando habilitado
  → 7. Calcular métricas e montar Plan
  → 8. Verificar restrições; retornar Plan ou lançar Error
```

### 1. Validação e território

[`validation/scenario.ts`](packages/core/src/validation/scenario.ts) verifica a presença de identificador, posto com localização, ao menos um polígono com três vértices, N ≥ 1 e A ≥ 0. A ausência de equipes gera um aviso, sem impedir o planejamento.

Pacientes com coordenadas não numéricas ou fora dos polígonos são excluídos da otimização. O teste territorial usa ray casting e aceita pontos na borda, com tolerância numérica na verificação de segmentos. Pertencer a qualquer um dos polígonos basta; não há associação de um polígono específico a cada equipe.

Erros invalidam o cenário e interrompem `planScenario`. Avisos e pacientes excluídos fazem parte do diagnóstico interno, mas não são devolvidos como campos do `Plan`. Pacientes excluídos também não entram na fila de não alocados ou no denominador da cobertura.

Essa validação é básica: não valida exaustivamente formatos de datas, unicidade de IDs, intervalos, jornadas ou velocidade. Os consumidores devem fornecer entradas consistentes com os tipos.

### 2. Calendário, prazos e demanda

[`demand/index.ts`](packages/core/src/demand/index.ts) gera N dias de segunda a sexta a partir de `startDate`, incluindo a data inicial se ela for útil. Fins de semana são pulados; feriados não são modelados. A disponibilidade de cada equipe é aplicada posteriormente pela estratégia.

Para cada condição de um paciente elegível, o prazo é calculado nesta precedência:

1. Havendo `lastVisitDate`, `dueDate = lastVisitDate + maxIntervalDays`.
2. Sem visita anterior, havendo `initialDueDate`, usa-se esse prazo explícito.
3. Sem ambas as datas, usa-se `scenario.startDate`.

Intervalos, atrasos e antecipações são medidos em **dias corridos**, enquanto N é contado em **dias úteis**. Um prazo pode cair no fim de semana e não é automaticamente deslocado para segunda-feira.

A pontuação inicial de cada condição é:

```text
atrasoInicial = max(0, startDate − dueDate)
priorityScore = 10 × atrasoInicial + 5 × priorityWeight
```

As condições são ordenadas pelo prazo mais antigo e, em empate de prazo, pela maior pontuação. O motor gera **um único candidato por paciente**, identificado por `cand_<patientId>_<conditionId>`, usando a condição principal. Não soma os pesos das condições nem gera múltiplas visitas recorrentes dentro da mesma janela. O candidato atual tem `isConditional: false`; os campos de dependência do contrato não são utilizados nessa geração.

A visita entra na demanda se já estiver vencida ou se seu prazo for até `últimoDiaÚtil + A`. Isso permite incluir candidatos que vencem após o fim da janela, desde que possam ser antecipados. A elegibilidade é novamente conferida para cada dia na estratégia principal. Candidatos são ordenados por `priorityScore` decrescente antes do roteamento.

### 3. Matrizes de custos

[`costs/haversine.ts`](packages/core/src/costs/haversine.ts) constrói matrizes densas entre o posto e **todos os pacientes territorialmente elegíveis**, mesmo os que não geraram candidatos. O posto ocupa o índice 0; `nodeIds` permite localizar os índices de cada paciente.

A distância usa Haversine, com raio terrestre de 6.371,0088 km. O tempo é:

```text
tempoMinutos(i, j) = distânciaKm(i, j) / velocidadeKmh × 60
```

As matrizes têm diagonal zero e custos simétricos. Representam distância geográfica e velocidade constante, sem malha viária, trânsito ou sentidos de circulação. Com velocidade não positiva, a função atual retorna tempo zero; uma entrada operacional deve fornecer velocidade positiva.

### 4. Contexto e escolha da estratégia

O orquestrador monta `PlanningContext` com `scenario`, `costMatrix`, `candidates` e `workingDays`. Cada estratégia implementa `RoutingStrategy.solve(context)` e retorna `{ routes, unallocatedVisits }`. A melhoria local, as métricas e a verificação são etapas compartilhadas, executadas fora da estratégia.

### 5. Construção das rotas

As três estratégias percorrem os dias cronologicamente e as equipes disponíveis na ordem em que aparecem em `scenario.teams`. Uma equipe com `availableDays` não vazio só recebe rotas nas datas listadas. Cada candidato alocado entra em um conjunto global de IDs, que impede sua reutilização em outras equipes ou dias dessa chamada.

A construção produz uma rota para cada par dia/equipe disponível, mesmo quando vazia. A próxima seção detalha a política da `main-heuristic`.

## Como o trabalho é dividido entre equipes

A distribuição atual é **sequencial por dia e por equipe**, nas três estratégias. Para cada dia útil, o programa filtra as equipes disponíveis e mantém a ordem do array `scenario.teams`. Constrói a rota da primeira equipe antes de começar a segunda, e assim por diante; depois passa ao próximo dia.

### Disponibilidade, capacidade e fila compartilhada

1. **Selecionar equipes do dia:** `availableDays: []` permite atuar em qualquer dia útil da janela; uma lista preenchida restringe a equipe às datas informadas. Equipes indisponíveis não recebem rota naquele dia.
2. **Construir a rota da equipe atual:** cada estratégia escolhe visitas da mesma fila de candidatos ainda não alocados, respeitando a elegibilidade temporal e `dailyWorkMinutes` da equipe. Atendimento, deslocamento e retorno ao posto precisam caber na jornada.
3. **Fixar as alocações:** cada candidato escolhido é marcado no conjunto global `allocatedCandidateIds`, compartilhado entre todas as equipes e dias dessa execução. As equipes seguintes recebem apenas os candidatos restantes.
4. **Passar à próxima equipe:** na `main-heuristic` e no baseline geográfico, isso ocorre quando nenhuma nova inserção é viável para a rota atual. No baseline de urgência, ocorre após percorrer a lista elegível e acrescentar as visitas que cabem. A rota pode terminar com tempo livre se os candidatos restantes não couberem ou ainda não puderem ser atendidos.
5. **Continuar nos próximos dias:** candidatos pendentes são reconsiderados conforme sua elegibilidade. Ao terminar a janela, os que permanecerem sem rota vão para `unallocatedVisits`.

A `main-heuristic` compara candidatos e posições **dentro da rota da equipe atual**. Ela não compara o custo de atribuir uma visita à equipe atual com o custo de atribuí-la a outra equipe. Os baselines também processam uma equipe por vez; o que muda é o critério de escolha das visitas, descrito na seção de comparação das estratégias.

### Exemplo de distribuição

Considere duas equipes disponíveis, na ordem `[Alpha, Beta]`, ambas com jornada de 240 minutos. Há seis visitas elegíveis de 60 minutos, com todos os pacientes na mesma localização do posto, de modo que os deslocamentos sejam zero:

| Etapa | Alocação | Jornada utilizada | Candidatos restantes |
| --- | --- | --- | --- |
| Construir Alpha | Quatro visitas escolhidas pela estratégia. | 240 de 240 min. | Duas visitas. |
| Construir Beta | As duas visitas restantes. | 120 de 240 min. | Nenhum. |

O programa não busca uma divisão de três visitas para cada equipe. Se houvesse apenas quatro visitas nessas mesmas condições, Alpha receberia todas e Beta teria uma rota vazia. Com deslocamentos reais, a quantidade de visitas que cabe depende também da sequência e da localização dos pacientes.

### Equilíbrio de carga e atribuições territoriais

A ordem em `scenario.teams` influencia quais equipes recebem primeiro as visitas elegíveis e pode alterar rotas, deslocamento e cobertura. Essa ordem permanece a mesma a cada dia; não há rodízio automático, cotas de visitas ou preferência pela equipe menos ocupada. Jornadas diferentes permitem capacidades diferentes, mas não produzem uma divisão proporcional deliberada.

Todos os pacientes elegíveis podem ser atendidos por qualquer equipe disponível. Os polígonos delimitam o território global do cenário; não há divisão de pacientes por território de equipe, vínculo fixo paciente/equipe ou seleção por especialidade dos profissionais. Os nomes de médico, enfermeiro e assistente social não participam da decisão de alocação.

A métrica `teamWorkloadImbalance` mede o desequilíbrio após o planejamento, mas não é usada para orientar as escolhas. O 1.5-opt melhora apenas a ordem das visitas dentro de cada rota: não transfere trabalho entre equipes ou dias. Em um replanejamento, as rotas são construídas novamente com o cenário atualizado, sem preservar obrigatoriamente a equipe de uma visita do plano anterior.

## Como funciona a `main-heuristic`

A implementação está em [`strategies/main-heuristic.ts`](packages/core/src/strategies/main-heuristic.ts). É uma heurística construtiva gulosa: escolhe a melhor inserção disponível para a rota atual, fixa essa escolha e repete até não haver outra inserção viável. Ela combina prioridade e custo de deslocamento em uma pontuação, sem resolver um problema de otimização global exato.

### Elegibilidade diária e antecipação

No dia `d`, para cada candidato ainda não alocado, calcula-se:

```text
Δdias = dueDate − d
```

O candidato é elegível se `Δdias ≤ A`:

- `Δdias < 0`: visita atrasada.
- `Δdias = 0`: visita vence hoje.
- `0 < Δdias ≤ A`: visita futura que pode ser antecipada.
- `Δdias > A`: visita ainda indisponível nesse dia.

Com A = 0, nenhuma visita futura é antecipada. Visitas vencidas continuam elegíveis, inclusive quando estão atrasadas antes do início da janela.

### Urgência recalculada para o dia

A pontuação inicial `priorityScore` permanece a gerada na etapa de demanda. A estratégia acrescenta uma urgência dependente do dia:

```text
Se Δdias ≤ 0:
  urgência = 1000 + 100 × max(0, −Δdias) + priorityScore

Se Δdias > 0:
  urgência = priorityScore − 10 × Δdias
```

O bônus de 1.000 vale também para visitas que vencem hoje; cada dia de atraso acrescenta 100 pontos. Visitas futuras recebem uma penalidade de 10 pontos por dia até o prazo. O atraso inicial já está incorporado em `priorityScore` e volta a contribuir na urgência diária.

Essa regra favorece visitas vencidas, mas **não estabelece prioridade absoluta**: o resultado depende também dos pesos clínicos e do custo incremental. Os coeficientes 1.000, 100, 10 e 2 da pontuação são constantes no código, sem configuração em `PlanOptions`.

### Inserção em todas as posições e jornada

Para uma rota com k visitas, a estratégia testa as k + 1 posições de inserção de cada candidato elegível. Em cada posição, substitui o trecho `a → b` por `a → i → b`, em que `i` é o paciente candidato. No começo ou no fim, um dos extremos é o posto.

```text
Δtempo = t(a, i) + t(i, b) − t(a, b)
Δdistância = dist(a, i) + dist(i, b) − dist(a, b)
```

Para uma rota vazia, ambos os extremos são o posto: o incremento inclui **ida e volta**. Como a rota é tratada como um circuito, o retorno também permanece incluído ao inserir novas visitas.

A posição só é viável se:

```text
jornadaAtual + Δtempo + duraçãoDaVisita ≤ team.dailyWorkMinutes
```

A jornada contém deslocamento e atendimento. A duração não recebe uma penalidade própria na pontuação, mas limita quais inserções cabem. Não há janelas de horário por paciente, pausas ou restrições de habilidade clínica na seleção.

### Escolha da melhor inserção

Entre todos os pares candidato/posição viáveis da rota atual, escolhe-se a maior pontuação:

```text
score = urgência − 2 × Δtempo
```

O custo usado diretamente é o **tempo incremental em minutos**. A distância incremental é contabilizada para os totais; com velocidade uniforme positiva, minimizar tempo equivale a minimizar distância para um mesmo candidato.

A atualização usa `score > bestScore`. Em empate exato, permanece o primeiro par encontrado, conforme a ordem dos candidatos e das posições. Não existe um limiar mínimo de score: uma inserção com pontuação negativa ainda pode ser escolhida se for a melhor viável.

Depois de inserir a visita, o algoritmo atualiza a jornada, marca o candidato como alocado e reavalia os candidatos restantes em todas as posições da nova rota. Se nenhum couber, encerra essa equipe e passa à próxima.

### Exemplo numérico

Considere A = 2, jornada atual de 170 minutos e limite de 240 minutos. Os custos abaixo representam as melhores posições de cada candidato nessa rota:

| Candidato | Prazo relativo ao dia | `priorityScore` | Duração | Δtempo | Urgência | Score | Cabe? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P1 | Atrasado 1 dia | 25 | 30 min | 8 min | 1125 | 1109 | Sim: 208 min |
| P2 | Vence hoje | 20 | 30 min | 3 min | 1020 | 1014 | Sim: 203 min |
| P3 | Vence em 2 dias | 40 | 30 min | 2 min | 20 | 16 | Sim: 202 min |
| P4 | Atrasado 2 dias | 30 | 60 min | 20 min | 1230 | 1190 | Não: 250 min |

P4 é descartado pela jornada, apesar da pontuação alta. P1 ganha entre os viáveis. A rota passa a consumir 208 minutos e todas as posições dos candidatos restantes são reavaliadas; seus incrementos podem mudar após essa inserção.

### Pseudocódigo, encerramento e limites

```text
alocados = conjunto vazio
para cada dia útil, em ordem:
  para cada equipe disponível, na ordem do cenário:
    rota = vazia; jornada = 0
    repetir:
      melhor = nenhum
      para cada candidato não alocado com prazo − dia ≤ A:
        calcular urgência do dia
        para cada posição da rota, incluindo as extremidades:
          calcular tempo incremental com retorno ao posto
          se jornada + incremento + atendimento couber:
            comparar urgência − 2 × incremento com o melhor score
      se não houver melhor: encerrar esta rota
      inserir melhor; atualizar jornada; registrar como alocado
    recalcular trechos e totais; guardar rota
listar todos os candidatos não alocados
```

Ao fechar a rota, a estratégia recalcula os trechos da sequência final e soma o retorno ao posto. Distâncias de rotas/trechos são arredondadas para duas casas decimais e tempos de deslocamento/jornada para uma. O retorno participa dos totais, mas não aparece como uma visita adicional.

Os candidatos restantes recebem um motivo geral: não couberam na capacidade da janela sem violar antecipação ou jornada. O algoritmo não fornece diagnóstico individual mais específico.

As equipes são preenchidas sequencialmente, sem comparar simultaneamente todas as equipes ou reservar capacidade para dias futuros. Alterar a ordem das equipes pode alterar o resultado. A estratégia não transfere visitas já alocadas entre rotas e não otimiza diretamente o equilíbrio de carga. A posterior melhoria 1.5-opt também não retoma a inserção de pendências, mesmo se liberar capacidade.

Para C candidatos, D dias úteis e até E equipes por dia, cada rodada de uma rota com k visitas examina até C × (k + 1) pares. Um limite superior conservador da construção, somando as rodadas, é O(D × E × C³); a matriz requer O(P²) tempo e memória, com P nós. Esses limites descrevem o código atual, não tempos medidos de benchmark.

## Etapas após a construção

### 6. Melhoria intra-rota 1.5-opt

[`improvement/one-half-opt.ts`](packages/core/src/improvement/one-half-opt.ts) atua separadamente em cada rota com **mais de duas visitas**:

1. Testa mover um único nó para outra posição (1-point relocate).
2. Ao encontrar a primeira redução superior a `1e-4` minuto, aceita e reinicia a busca de reinserção.
3. Quando não há reinserção melhor, testa inverter subsegmentos (2-opt).
4. Ao aceitar uma inversão, reinicia a busca desde a reinserção; termina quando nenhum movimento melhora o custo.

O custo avaliado soma deslocamentos, atendimentos e retorno ao posto. Como o conjunto de visitas e suas durações permanece igual, a melhoria decorre do deslocamento. Datas, equipes e candidatos atendidos são preservados. O resultado é um ótimo local para os movimentos examinados, sem garantia de ótimo global.

Após a busca, recalculam-se trechos, totais e horários estimados, assumindo saída às **08:00**. Uma passagem testa O(k²) movimentos, cada um com recálculo O(k); o custo total depende de quantas melhorias forem aceitas.

**Particularidade dos horários:** rotas com até duas visitas retornam imediatamente, sem preencher horários. As estratégias constroem `estimatedStartTime` e `estimatedEndTime` vazios; assim, esses campos também ficam vazios quando o 1.5-opt está desligado. Não há uma etapa independente de geração de horários para esses casos.

### 7. Métricas do plano previsto

[`metrics/index.ts`](packages/core/src/metrics/index.ts) calcula os indicadores após a melhoria:

| Métrica | Cálculo implementado |
| --- | --- |
| `coveragePercentage` | 100 × (candidatos − não alocados) / candidatos; 100% quando não há candidatos. |
| `totalOverdueDays` | Soma do atraso de cada visita alocada na data da rota, mais o atraso das não alocadas em relação a `startDate`. |
| `totalTravelDistanceKm` | Soma das distâncias das rotas, incluindo retorno ao posto. |
| `totalTravelTimeMinutes` | Soma dos tempos de deslocamento, incluindo retorno. |
| `teamUtilizationPercentage` | Média dos percentuais jornada usada / jornada disponível de cada par equipe/dia com rota, incluindo rotas vazias. |
| `teamWorkloadImbalance` | Desvio padrão populacional das jornadas usadas por rota, em minutos, sem agregação prévia por equipe. |

Apesar do comentário no código mencionar o final da janela, **o atraso das não alocadas é avaliado em `startDate`**, não no último dia útil. Uma visita que vencer durante a janela e ficar pendente pode, portanto, contribuir com zero nesse indicador.

Cobertura significa **alocação prevista**, não atendimento efetivamente concluído. O núcleo não inclui tempo computacional em `PlanMetrics`; a bancada mede esse tempo externamente. Métricas previstas e resultados de execução devem ser analisados separadamente.

### 8. Verificação antes do retorno

[`verification/index.ts`](packages/core/src/verification/index.ts) refaz a validação básica do cenário e verifica:

- Se a equipe de cada rota existe e está disponível na data.
- Se `totalWorkTimeMinutes` não excede sua jornada diária.
- Se não há paciente duplicado dentro de uma mesma rota.
- Se todo paciente visitado pertence ao conjunto territorialmente elegível.

Se houver erro, `planScenario` lança uma exceção com o diagnóstico em vez de retornar o plano. Uma cobertura inferior a 100% não invalida o plano: é representada por pendências e métricas.

O verificador atual não recalcula a matriz ou os totais e não verifica antecipação, pertencimento da data ao horizonte, unicidade entre rotas distintas ou correspondência completa dos candidatos/condições. A geração e a estratégia implementam parte dessas propriedades; elas não são todas verificadas independentemente por `verifyPlan`.

## Comparação das estratégias

| Estratégia | Elegibilidade diária | Escolha e posição de inserção |
| --- | --- | --- |
| `main-heuristic` | Vencidas, devidas hoje e futuras até A dias. | Maior score de urgência menos tempo incremental; testa todas as posições. |
| `urgency-baseline` | Apenas vencidas ou devidas hoje. | Ordena por `priorityScore` decrescente e acrescenta ao fim as visitas que cabem. |
| `nearest-baseline` | Apenas vencidas ou devidas hoje. | Escolhe o candidato viável com menor tempo desde o último nó e acrescenta ao fim. |

Embora a descrição interna do baseline de urgência mencione ordem cronológica e equipe de menor custo, o código efetivo usa a pontuação inicial e processa equipes sequencialmente. Os três métodos incluem retorno na checagem de capacidade e recebem o mesmo pós-processamento 1.5-opt quando habilitado. A matriz e a demanda são compartilhadas; a política de antecipação dos baselines é diferente da principal.

## Execução real e replanejamento

`applyVisitResults` recebe `ScenarioState` (`scenario`, `history`, `currentDate`) e uma lista de resultados por paciente e condição:

- `completed`: atualiza `lastVisitDate` da condição para a data informada. O próximo prazo será essa data mais `maxIntervalDays`.
- `missed`: mantém as datas da condição, preservando o prazo da pendência.

A função retorna um estado com os pacientes atualizados, versão do cenário incrementada e resultados anexados ao histórico. Não altera o estado de entrada. Uma conclusão atualiza apenas a condição explicitamente informada; não marca automaticamente as outras condições do paciente como atendidas. Se houver vários resultados para a mesma condição na chamada, a implementação considera o primeiro encontrado.

**Avançar a janela é responsabilidade do chamador:** `applyVisitResults` não muda `scenario.startDate` nem `currentDate`. Para planejamento em janela móvel, atualize `startDate` para o próximo dia a planejar e execute novamente `planScenario`.

```typescript
import { applyVisitResults, planScenario } from '@routing/core';
import type { Scenario, ScenarioState, VisitResult } from '@routing/core';

// cenário, resultados e próxima data fornecidos pela aplicação
function replan(scenario: Scenario, results: VisitResult[], nextStartDate: string) {
  const state: ScenarioState = {
    scenario,
    history: [],
    currentDate: scenario.startDate
  };
  const updated = applyVisitResults(state, results);
  const nextState: ScenarioState = {
    ...updated,
    currentDate: nextStartDate,
    scenario: { ...updated.scenario, startDate: nextStartDate }
  };
  const plan = planScenario(nextState.scenario, {
    strategyId: 'main-heuristic',
    enable1_5Opt: true
  });
  return { state: nextState, plan };
}
```

A demanda é regenerada a partir das condições atualizadas, em vez de copiar a lista de pendências do plano anterior. A simulação dinâmica da bancada avança `startDate` a cada dia; o endpoint atual de resultados do backend replaneja com o `startDate` existente, mesmo recebendo `currentDate`.

## Backend e interface web

O servidor Fastify persiste cenários por `(id, version)` e planos vinculados à versão utilizada. O banco é criado em `data/routing.db` relativo ao diretório de trabalho do processo; usando o script npm do pacote, fica em `artefato/packages/server/data/routing.db`. WAL e chaves estrangeiras são habilitados.

| Endpoint | Função |
| --- | --- |
| `GET /api/experimental-scenarios` e `/:id` | Listar e carregar cenários JSON da bancada. |
| `POST /api/scenarios` | Importar/salvar cenário. |
| `GET /api/scenarios` e `/:id?version=...` | Listar e consultar cenários/versões. |
| `POST /api/scenarios/:id/plan` | Planejar a última versão e persistir o plano. |
| `GET /api/scenarios/:id/plans` | Listar planos do cenário. |
| `GET /api/plans/:planId` | Obter um plano completo. |
| `POST /api/scenarios/:id/results` | Aplicar resultados, salvar nova versão e replanejar. |
| `GET /api/export/csv` e `/api/export/gpx` | Exportar uma rota, usando `scenarioId`, `planId`, `date` e `teamId`. |

O schema inclui `visit_results`, mas o handler atual de resultados não grava nessa tabela nem recupera um histórico completo; ele persiste o cenário atualizado e o novo plano. O histórico retornado por `applyVisitResults` é responsabilidade do consumidor que desejar mantê-lo.

O CSV reúne ordem, posto/paciente, horários, deslocamentos e coordenadas. O GPX contém waypoints e um track ordenado do posto aos pacientes e de volta, sem cálculo de trajeto pelas ruas.

A interface React/Vite/Leaflet permite importar JSON, carregar cenários experimentais pela API, selecionar estratégia e data, visualizar pacientes, território, rotas por equipe e métricas, e registrar resultados reais. Se a geração via API falhar, tenta planejar localmente em memória com o mesmo núcleo. Registro de resultados e exportação persistida dependem do servidor; o fallback não fornece toda a funcionalidade do backend.

## Bancada experimental e manutenção

Na raiz do repositório:

```bash
# Instalar dependências da bancada
npm install --prefix experimentos

# Compilar core e bancada, gerar cenários, simular e gerar relatório
npm run experiments:all
```

`npm run experiments` executa apenas o benchmark estático já compilado; `npm run experiments-dynamic` executa a simulação dinâmica. Consulte o [README dos experimentos](../experimentos/README.md) para o protocolo e o [guia consolidado do artefato](AGENTS.md) para regras de manutenção.

Ao adicionar uma estratégia, implemente `RoutingStrategy`, registre-a no mapa de `src/index.ts` e atualize os consumidores que oferecem a seleção de métodos. Preserve a separação entre construção, melhoria local, métricas e verificação, e documente alterações no comportamento observado pelo backend, frontend e experimentos.
