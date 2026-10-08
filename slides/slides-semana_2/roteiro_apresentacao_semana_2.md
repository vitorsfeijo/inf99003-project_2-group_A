# Roteiro de Apresentação — Semana 2
**Projeto:** Planejamento de Visitas Domiciliares na APS (PHVD-APS)  
**Disciplina:** INF99003 — Projeto 2 — Grupo A
**Integrantes:** Fábio, Tobias e Vítor  
**Tempo Estimado:** 7 a 8 minutos (média de ~40 a 50 segundos por slide)

---

## Estrutura Geral da Fala

* **Objetivo da apresentação:** Demonstrar que o grupo concluiu a etapa de **concepção do projeto e especificação formal**, saindo da revisão bibliográfica (Semana 1) para um modelo matemático e algorítmico rigoroso pronto para implementação.
* **Postura:** Não leia o texto dos slides. Use os slides como âncora visual enquanto explica a **motivação das decisões tomadas** e o **rigor científico**.

---

### Slide 1: Capa (0:00 – 0:30)
* **O que citar:**
  * Cumprimentar o professor e a turma.
  * Apresentar o título do projeto: *"Planejamento de Visitas Domiciliares na Atenção Primária à Saúde: uma Heurística de Horizonte Móvel para Redução de Atrasos e Otimização de Rotas (PHVD-APS)"*.
  * Informar que esta entrega da Semana 2 consolida o **Projeto de Pesquisa** e o **Plano de Desenvolvimento**.
* **Frase de transição:** *"Para contextualizar onde o nosso modelo atua, vamos relembrar rapidamente a dor real enfrentada pelas equipes de Saúde da Família."*

---

### Slide 2: O Problema (0:30 – 1:15)
* **O que citar:**
  * **Contexto:** Na Estratégia Saúde da Família, equipes multiprofissionais realizam visitas domiciliares periódicas para acompanhamento de doentes crônicos (diabetes, hipertensão).
  * **A Dor Real:** Hoje esse planejamento é manual ou inexistente. Isso causa rotas ineficientes, sobrecarga desigual entre equipes e acúmulo de **pendências** (visitas atrasadas).
  * **A Complexidade Combinatória:** Destacar que o problema não é só traçar uma rota no mapa (TSP). São **4 decisões interdependentes**:
    1. *Quais* pacientes priorizar?
    2. Em *qual dia* da semana atender?
    3. Para *qual equipe* atribuir?
    4. *Qual a ordem* das casas na rota?
* **Destaque:** Enfatizar que a decisão tomada hoje altera a capacidade e os prazos dos dias futuros.
* **Frase de transição:** *"Diante dessa complexidade, formulamos nossa pergunta de pesquisa e nossa hipótese experimental."*

---

### Slide 3: Pergunta de Pesquisa e Hipótese (1:15 – 2:00)
* **O que citar:**
  * **Pergunta:** Quanto uma heurística operando em uma janela móvel de $N$ dias melhora o atraso acumulado, a cobertura de pendências e o deslocamento em relação a regras simples de despacho diário?
  * **Hipótese:** Acreditamos que selecionar visitas combinando **urgência clínica atual + prazos dos próximos dias**, seguido de inserção gulosa de menor custo e refinamento local com **2-opt**, reduzirá drasticamente o atraso acumulado após replanejamentos, mantendo tempo de execução e deslocamento controlados.
* **Destaque:** Reforçar que isso é uma hipótese a ser validada experimentalmente, e não uma verdade assumida.
* **Frase de transição:** *"Para testar essa hipótese, formalizamos o modelo em entidades e dados de entrada bem delimitados."*

---

### Slide 4: Entidades e Dados de Entrada (2:00 – 2:40)
* **O que citar:**
  * O problema é modelado por 6 entidades essenciais:
    * **Posto de saúde:** Ponto fixo de saída e chegada de todas as rotas diárias.
    * **Equipes multiprofissionais:** Médico, enfermeiro e assistente social que se deslocam juntos, com uma jornada diária útil $H_{k,t}$.
    * **Pacientes:** Nós do grafo, com coordenadas e tempo estimado de atendimento ($s_i$).
    * **Condições clínicas:** Determinam o intervalo máximo entre contatos e o peso de prioridade.
    * **Resultado de visita:** Concluída ou não realizada (evento real de campo).
    * **Janela móvel:** $N$ dias úteis futuros e parâmetro de antecipação $A$.
* **Frase de transição:** *"A dinâmica entre essas entidades é governada por regras temporais estritas."*

---

### Slide 5: Regras Temporais e Dinâmica de Prazos (2:40 – 3:30)
* **O que citar:**
  * **Data-limite:** Calculada em dias corridos ($\text{última visita} + \text{intervalo}$). O atraso só começa a contar quando o prazo estoura.
  * **Classificação diária:** Cada visita é classificada em *Vencida*, *Vence hoje* ou *Futura*.
  * **Antecipação ($A$):** Uma visita futura só pode ser adiantada se estiver a no máximo $A$ dias do seu vencimento e se houver capacidade ociosa.
  * **A Regra de Ouro da Conclusão vs. Falha:**
    * *Visita concluída:* Atualiza a data real no histórico e gera um novo prazo futuro.
    * *Visita não realizada (falha em campo):* **Não altera a data da última visita**. O paciente volta imediatamente à fila com o prazo original e continua acumulando atraso diário.
* **Frase de transição:** *"Todas essas regras convergem no pipeline de execução do nosso artefato, que vamos ver a seguir."*

---

### Slide 6: Pipeline de Execução (3:30 – 4:30) — [SLIDE CHAVE]
* **O que citar:**
  * Apresentar o diagrama da esquerda para a direita:
    1. **Entradas:** Cenário territorial, histórico de visitas anteriores e calendário das equipes.
    2. **Preparação no Núcleo:** Valida os polígonos territoriais, gera a fila de pendências e recebe a matriz de caminhada calculada pelo OSRM.
    3. **Otimização:** O *Planejador* aloca as visitas para os $N$ dias; o *2-opt* desfaz cruzamentos dentro de cada rota; e o *Verificador* garante que nenhuma rota exceda a jornada diária.
    4. **Saídas:** As rotas são renderizadas no mapa OSM e exportadas para CSV e GPX.
    5. **Ciclo Dinâmico de Replanejamento (Faixa inferior):** Ao final do dia, o resultado real de campo alimenta o replanejamento: o histórico já executado é congelado, a janela avança mantendo $N$ dias úteis à frente e uma nova versão auditável do plano é gerada.
* **Dica visual:** Aponte para o ciclo inferior tracejado que retorna ao histórico/prazos.
* **Frase de transição:** *"Para operar esse pipeline, desenhamos uma interface gráfica mínima e desacoplada."*

---

### Slide 7: Interface Mínima e Suporte a Campo (4:30 – 5:10)
* **O que citar:**
  * A interface foi concebida para ser simples e funcional, sem complexidade desnecessária:
    * **Cadastros (mini-CRUD):** Permite configurar postos, pacientes e equipes sem editar código.
    * **Mapa com OpenStreetMap (Leaflet/Folium):** Visualização das rotas coloridas por equipe e numeração das paradas.
    * **Tratamento das rotas:** Os traçados seguem a geometria de caminhada retornada pelo OSRM.
    * **Exportação em CSV e GPX:** Requisito crucial para campo. O arquivo GPX permite que o agente comunitário carregue a rota em aplicativos de navegação offline no celular (como OsmAnd ou Google Maps) mesmo sem sinal de internet.
* **Frase de transição:** *"Para validar se a nossa heurística é de fato vantajosa, precisamos compará-la com baselines bem definidos."*

---

### Slide 8: Métodos Implementados e Comparados (5:10 – 5:55)
* **O que citar:**
  * Implementaremos e compararemos 4 métodos sob as exatas mesmas condições:
    1. **Baseline de urgência:** Ordena por vencimento clínico mais próximo e aloca na equipe viável de menor custo (regra ingênua de prioridade).
    2. **Baseline geográfico:** Roteamento pelo vizinho mais próximo viável (regra ingênua puramente espacial).
    3. **Heurística principal (nossa proposta):** Pontua candidatos ponderando atraso, gravidade clínica, proximidade de prazos futuros e custo marginal de inserção, com antecipação controlada.
    4. **Melhoria local (2-opt):** Aplicada sobre as rotas geradas para eliminar ineficiências de deslocamento.
  * Todos receberão o mesmo estado inicial, mesmo calendário e mesma sequência de eventos reais simulados.
* **Frase de transição:** *"Essa comparação será submetida a um rigoroso protocolo experimental."*

---

### Slide 9: Cenários e Métricas (5:55 – 6:40)
* **O que citar:**
  * **Cenários Sintéticos Reproduzíveis:** Gerados por código com sementes fixadas, testando cenários de:
    * Capacidade folgada, justa e insuficiente (sobrecarga).
    * Pacientes concentrados vs. dispersos geograficamente.
    * Falhas de visitação isoladas e consecutivas.
    * Casos-limite (zero equipes, paciente fora da área de abrangência).
  * **Métricas:** Mediremos cobertura de pendências, dias de atraso acumulado, tempo de deslocamento, desequilíbrio de carga entre equipes e tempo computacional.
  * **Cuidado metodológico:** Separamos claramente as métricas do *plano previsto* das métricas do *plano efetivamente executado*, já que visitas programadas podem falhar em campo.
* **Frase de transição:** *"Com o projeto completamente especificado, organizamos o plano de trabalho para as próximas semanas."*

---

### Slide 10: Próximas Semanas e Próximos Passos (6:40 – 7:30)
* **O que citar:**
  * **Status:** A Semana 2 encerra a concepção formal do projeto e o plano de desenvolvimento.
  * **Semana 3 (Implementação):**
    * Construção do núcleo de otimização (gerador, matriz de caminhada, heurística, baselines e 2-opt).
    * Desenvolvimento da interface com mapa OSM e exportador CSV/GPX.
  * **Semana 4 (Avaliação e Escrita):**
    * Execução dos experimentos em lote com todas as instâncias sintéticas.
    * Análise dos resultados (curvas de sensibilidade e dominância de Pareto).
    * Redação e revisão final do artigo científico.
* **Frase de transição:** *"Essas escolhas foram fundamentadas na literatura revisada na Semana 1."*

---

### Slide 11: Referências (7:30 – 7:45)
* **O que citar:**
  * Não leia a lista de autores.
  * Apenas cite: *"Nosso modelo combina os fundamentos de APS e territorialização do SUS (Faria, CONASS e Fiocruz) com o trabalho de Randriamihaja et al. (2024), que demonstrou a viabilidade de otimização de rotas para agentes de saúde comunitária utilizando dados abertos do OpenStreetMap."*

---

### Slide 12: Encerramento (7:45 – 8:00)
* **O que citar:**
  * *"Concluímos a especificação do projeto e estamos prontos para iniciar a implementação da Semana 3. Obrigado a todos, estamos abertos a dúvidas e sugestões."*

---

## Possíveis Perguntas da Banca e Como Responder

1. **Pergunta:** *"Como são calculados os deslocamentos a pé?"*
   * **Resposta:** *"O OSRM usa a malha OpenStreetMap preparada com o perfil de caminhada. A matriz de distâncias e durações entra no planejador; a geometria das rotas exibidas vem da API Route."*

2. **Pergunta:** *"Qual a diferença entre o problema de vocês e um Vehicle Routing Problem (VRP) padrão?"*
   * **Resposta:** *"Um VRP clássico apenas roteia pontos conhecidos em um único dia. O nosso problema combina: (1) horizonte temporal de múltiplos dias; (2) seleção e priorização sob capacidade insuficiente (nem todo mundo cabe); (3) dinâmica de intervalos clínicos recorrentes; e (4) ciclo de replanejamento diário com avanço de janela móvel após falhas reais de atendimento."*

3. **Pergunta:** *"Por que a equipe de vocês tem 3 profissionais juntos (médico, enfermeiro e assistente social) em vez de rotear cada um individualmente?"*
   * **Resposta:** *"Adotamos o recorte da equipe multiprofissional da ESF que se desloca em conjunto para atendimentos domiciliares complexos. Isso simplifica o modelo inicial ao evitar o escalonamento individual de agendas, permitindo que a pesquisa foque na dinâmica do horizonte móvel e na redução de atrasos acumulados."*
