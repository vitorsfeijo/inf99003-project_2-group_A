# Pipeline de Execução do Algoritmo — PHVD-APS

Este documento descreve detalhadamente o fluxo de execução arquitetado no diagrama [`pipeline.tex`](pipeline.tex) (e compilado em [`pipeline.pdf`](pipeline.pdf)), explicitando sua fundamentação técnica conforme definida no [Projeto de Pesquisa](../../projeto_de_pesquisa/projeto_de_pesquisa.md) e no [Plano de Desenvolvimento](../../plano_de_desenvolvimento.md).

O pipeline modela o problema de **Planejamento de Visitas Domiciliares na Atenção Primária à Saúde (PHVD-APS)** sob a ótica de um **horizonte móvel de $N$ dias úteis**, integrando prioridade clínica, restrições territoriais, capacidade de equipes e replanejamento dinâmico diante de falhas de atendimento.

---

## Diagrama Geral do Fluxo

```
[ 1. ENTRADAS ]              [ 2. NÚCLEO DE OTIMIZAÇÃO ]             [ 3. SAÍDAS ]
Cenário / Território  ───►  Validação de Dados        ──┐
Histórico de Visitas  ───►  Prazos e Pendências       ──┼──►  Planejador (N dias)  ──►  Rotas no Mapa OSM
Equipes e Jornadas    ───►  Grafo e Matriz de Custos  ──┘     (Heurística/Baseline)       │
                                                                   │                      ▼
                                                              Melhoria Local (2-opt) ──►  Métricas e Atrasos
                                                                   │                      │
                                                              Verificador Viabilidade     ▼
                                                                   │                Exportação CSV / GPX
                                                                   │                      │
                                                                   ▼                      ▼
[ CICLO DINÂMICO ]    Replanejamento (Avanço N dias)  ◄───  Registro em Campo ◄───────────┘
```

---

## 1. Camada de Entradas (Inputs)

O sistema parte de três fontes primárias de informação representativas do território de uma Unidade Básica de Saúde (UBS):

### 1.1. Cenário e Território
* **Posto de Saúde (Origem/Destino):** Coordenadas geográficas da UBS. Todas as equipes partem e retornam obrigatoriamente a este ponto a cada jornada de trabalho.
* **Pacientes Adscritos:** Cadastro dos pacientes com identificadores pseudonimizados, coordenadas geográficas da residência, duração estimada do atendimento ($s_i$) e condições clínicas acompanhadas.
* **Polígonos de Atuação:** Delimitação territorial da área de abrangência da unidade. Apenas pacientes contidos dentro dos polígonos válidos entram na fila de otimização.

### 1.2. Histórico de Visitas
* Registra para cada paciente e para cada condição clínica acompanhada a **data em que ocorreu a última visita efetivamente concluída**.
* Para pacientes recém-cadastrados ou sem histórico prévio, fornece a data-limite inicial explícita de acompanhamento.

### 1.3. Equipes e Jornadas
* **Equipes Multiprofissionais:** Cada equipe representa a composição padrão da Estratégia Saúde da Família (médico, enfermeiro e assistente social) que se deslocam juntos em um único veículo ou a pé.
* **Disponibilidade e Jornada ($H_{k,t}$):** Limite de tempo útil (em minutos/horas) disponível para a equipe $k$ no dia de trabalho $t$. Dias sem expediente, capacitações ou ausência de profissionais resultam em capacidade zero ($H_{k,t} = 0$).

---

## 2. Núcleo de Otimização — Preparação

Antes da atribuição de rotas, os dados brutos são validados e transformados em estruturas formais de grafos e prazos:

### 2.1. Validação de Dados
* Valida a integridade temporal (datas válidas, $N \ge 1$, antecipação $A \ge 0$).
* Aplica filtragem espacial: verifica se as coordenadas dos pacientes estão dentro dos polígonos de atuação (rejeitando pacientes fora da área de abrangência).
* Impede a execução caso existam geometrias inválidas, ausência de posto de partida ou inconsistências de calendário.

### 2.2. Geração de Prazos e Pendências
Para cada paciente $i$ e condição clínica:
1. **Cálculo da Data-Limite ($d_{\text{lim}}$):**
   $$d_{\text{lim}} = \text{Data da última visita concluída} + \text{Intervalo da condição (em dias corridos)}$$
2. **Classificação Temporal para cada dia de trabalho $t$:**
   * **Vencida (Pendência):** $d_{\text{lim}} < t$ (visita atrasada que já deveria ter sido realizada).
   * **Vence Hoje:** $d_{\text{lim}} = t$.
   * **Futura:** $d_{\text{lim}} > t$, elegível para antecipação se estiver dentro do horizonte de antecipação permissível ($t \le d_{\text{lim}} \le t + A$).
3. **Métrica de Atraso Acumulado:**
   $$\text{Atraso}(i, t) = \max(0, \; t - d_{\text{lim}})$$
4. **Recorrências Condicionais:** Caso uma visita seja prevista dentro da janela de $N$ dias, sua próxima visita recorrente já pode ser projetada como *condicional* para os dias subsequentes do plano.

### 2.3. Grafo e Matriz de Custos
* Modela o território como um grafo completo ponderado $G = (V, E)$, onde $V = \{0\} \cup \{1, \dots, n\}$ representa o posto de saúde ($0$) e as residências elegíveis ($1 \dots n$).
* **Matriz de Distâncias e Tempos ($d_{ij}$):** O OSRM calcula distâncias e durações na rede de caminhada do OpenStreetMap e entrega a matriz ao planejador.

---

## 3. Núcleo de Otimização — Otimização

A alocação das visitas ao longo dos $N$ dias úteis combina seleção por urgência, inserção em rota e melhoria local:

### 3.1. Planejador de Horizonte Móvel ($N$ dias)
Opera dia a dia dentro da janela futura, decidindo simultaneamente **qual visita atender**, **em qual dia**, **por qual equipe** e **em qual posição da rota**:
* **Baseline de Urgência (EDD):** Ordena os pacientes pelo prazo mais próximo ($d_{\text{lim}}$ ascendente) e insere cada um na equipe que apresentar o menor acréscimo viável de rota.
* **Baseline Geográfico (Nearest-Neighbor):** Constrói rotas diárias selecionando iterativamente o vizinho mais próximo viável a partir da última posição.
* **Heurística Principal com Antecipação:**
  * Pontua os candidatos combinando: atraso acumulado, peso clínico da condição, proximidade do prazo nos dias seguintes e custo marginal de inserção:
    $$\Delta \text{Custo}(a, i, b) = d(a, i) + d(i, b) - d(a, b)$$
  * Permite antecipar visitas futuras quando houver capacidade ociosa, mas aplica restrições estritas de prioridade para impedir que uma visita futura de baixo risco clínico desloque uma visita já vencida.

### 3.2. Melhoria Local (2-opt Intra-Rota)
* Após a inserção das visitas de um dia, aplica movimentos de troca de arestas `2-opt` dentro da rota de cada equipe para eliminar cruzamentos e minimizar o deslocamento total, preservando inalterados os dias de atendimento e as regras de capacidade.

### 3.3. Verificador de Viabilidade
Antes de publicar qualquer versão do plano, confere rigorosamente:
1. **Origem e Destino:** Toda rota da equipe inicia e termina no posto de saúde.
2. **Capacidade da Jornada:**
   $$\sum \text{tempo de deslocamento} + \sum s_i \le H_{k,t}$$
3. **Unicidade:** Um paciente não pode receber mais de uma visita no mesmo dia.
4. **Antecipação:** Nenhuma visita é programada com antecedência superior a $A$ dias corridos do seu prazo.

---

## 4. Camada de Saídas e Apresentação

O resultado calculado pelo núcleo de otimização é consolidado para exibição e uso operacional:

### 4.1. Rotas por Equipe no Mapa OSM
* Exibe no mapa interativo com tiles de fundo do **OpenStreetMap** (renderizados via Leaflet.js na web ou Folium em scripts de avaliação).
* Cada equipe possui uma **cor estável** ao longo de todos os dias. As residências são identificadas com numeração ordinal da sequência de atendimento.
* Traçados seguem a geometria de caminhada retornada pelo OSRM.

### 4.2. Métricas de Qualidade e Fila Restante
* Relatório consolidado contendo:
  * Fração de visitas pendentes atendidas;
  * Dias de atraso acumulados ao longo do horizonte;
  * Quilometragem e tempo total de viagem planejado;
  * Taxa de ocupação e desbalanceamento de jornada entre equipes;
  * Fila de pacientes que permaneceram sem atendimento por falta de capacidade.

### 4.3. Exportação em Arquivo (CSV e GPX)
Para viabilizar o uso em campo pelas equipes de saúde mesmo em locais com conectividade instável:
* **CSV:** Tabela estruturada (ordem, identificador do paciente, horário estimado, endereço/coordenadas, equipe e duração).
* **GPX:** Arquivo de rota com waypoints ordenados, compatível com receptores GPS e aplicativos de navegação offline móveis (como OsmAnd e Google Maps).

---

## 5. Ciclo Dinâmico de Replanejamento (Feedback Loop)

O grande diferencial do projeto em relação a roteirizadores estáticos é o tratamento explícito da execução real:

```
[Execução do Dia de Trabalho]
         │
         ▼
[Visita Concluída]           [Visita Não Realizada (Ausência/Recusa)]
         │                                       │
         ▼                                       ▼
Atualiza data da última visita          Data da última visita não muda
Define novo prazo futuro:               Retorna à fila com prazo original
$d_{\text{lim}} = \text{hoje} + \text{intervalo}$       Continua acumulando atraso diário
         │                                       │
         └───────────────────┬───────────────────┘
                             │
                             ▼
              [Congelar Histórico Executado]
                             │
                             ▼
            [Avançar Janela Móvel em 1 Dia Útil]
                             │
                             ▼
         [Reexecutar Planejador para Dias Futuros]
                             │
                             ▼
         [Gerar Nova Versão Auditável do Plano ($V_{t+1}$)]
```

1. **Registro em Campo:** Ao encerrar o dia de trabalho, cada visita programada recebe seu resultado real (`concluída` ou `não realizada` com motivo opcional). Visitas não registradas são assumidas por padrão como não realizadas.
2. **Atualização do Histórico:** 
   * Se **concluída**: o histórico de visitas é atualizado com a data real do atendimento, recalculando os prazos futuros daquele paciente para os ciclos seguintes.
   * Se **não realizada**: a data da última conclusão permanece a original. O paciente retorna imediatamente ao topo da fila de pendências e continua acumulando atraso a cada novo dia.
3. **Replanejamento Dinâmico:**
   * A parte do plano já executada fica **congelada** no banco de dados para fins de auditoria histórica.
   * A janela avança mantendo $N$ dias úteis à frente.
   * As recorrências condicionais afetadas são descartadas e recalculadas.
   * O planejador gera uma **nova versão do plano** para os dias restantes, destacando para o gestor quais visitas foram remanejadas.

---

## 6. Mapeamento com a Hipótese de Pesquisa

O pipeline implementa exatamente a arquitetura necessária para testar a hipótese central do projeto:

> *"Uma seleção orientada por urgência e prazos futuros, seguida de inserção de menor custo e melhoria local, reduz o atraso acumulado após replanejamentos sem elevar excessivamente o deslocamento ou o tempo computacional."*

Ao isolar a preparação dos dados, a heurística de alocação temporal e o ciclo dinâmico de eventos, o artefato garante que baselines e heurísticas concorrentes sejam executados sobre **idênticas instâncias sintéticas, mesmas restrições e mesmos eventos reais simulados**, assegurando rigor científico e reprodutibilidade experimental.
