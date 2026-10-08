# Blocos prontos para os slides

Material para quem vai **montar os slides**. A sequência é uma sugestão de narrativa; os textos entre aspas e os números em destaque podem ser copiados. Resultados da [análise fatorial com caminhada](../../experimentos/analise/fatorial-caminhada/resumo.md), gerada com 15, 30, 45 e 90 pacientes. O [relatório interativo](../../experimentos/analise/fatorial-caminhada/relatorio.html) permite baixar os gráficos em PNG.

## Slide 1 — O problema

**Título pronto:** Visitas domiciliares disputam tempo, prioridade e deslocamento

**Texto pronto:** “A equipe precisa atender pessoas com prioridades e prazos diferentes dentro de uma jornada limitada. Quando um paciente está ausente, a visita continua pendente e a agenda precisa ser refeita.”

**Visual sugerido:** posto de saúde → pacientes com prazos distintos → uma equipe com 240 minutos de trabalho por dia; uma ausência devolve a visita à fila.

## Slide 2 — Como simulamos

**Texto pronto:** “Usamos **um território base**, a US Restinga. Os pacientes são sintéticos. Variamos quatro quantidades de pacientes (15, 30, 45 e 90), três tamanhos de área desse mesmo território, três horizontes, três proporções de visitas já vencidas e três sementes de sorteio. A conta é 1 território × 3 sementes × 4 quantidades de pacientes × 3 áreas × 3 horizontes × 3 proporções de visitas vencidas = **324 cenários distintos**. Em cada cenário, calculamos um plano inicial com cada uma das três estratégias: 324 × 3 = **972 planos iniciais**. Depois, para cada estratégia, simulamos três probabilidades de ausência: 972 × 3 = **2.916 execuções dinâmicas**. Cada execução percorre todos os dias úteis do horizonte e refaz a agenda a cada dia.”

**Números para os cartões:** **324 cenários** = 1 território base × 3 sementes × 4 quantidades de pacientes × 3 áreas × 3 horizontes × 3 proporções de visitas vencidas. **2.916 execuções** = 324 cenários × 3 estratégias × 3 probabilidades de ausência.

**Visual sugerido:** cinco fatores em cartões; destaque em cor para o novo nível de **90 pacientes**. A tabela exata está em [desenho-experimental.md](desenho-experimental.md).

## Slide 3 — Como medimos os caminhos

**Título pronto:** A comparação usa rotas a pé pela rede OpenStreetMap

**Texto pronto:** “O OSRM com perfil `foot.lua` calculou distâncias e durações de caminhada entre o posto e os pacientes. A mesma matriz foi usada pela heurística principal, pelo vizinho mais próximo e pela estratégia de urgência.”

**Visual sugerido:** mini mapa com ruas e três pontos ligados pela malha; legenda “matriz de custo comum às três estratégias”. As coordenadas dos pacientes são sintéticas.

## Slide 4 — Como a heurística funciona

**Título pronto:** Construir, melhorar, recuperar pendências e replanejar

**Pseudocódigo curto para copiar:**

```text
rotas ← vizinho mais próximo viável
rotas ← 1.5-opt: reinserção de visita + inversão de segmento
rotas ← melhorar tempo e atraso com trocas entre dias
rotas ← inserir pendências por prioridade e prazo
rotas ← aumentar a prioridade atendida a tempo sem violar jornada ou orçamento
se houver ausência: registrar missed e planejar o próximo dia
verificar formalmente cada plano
```

**Visual sugerido:** fluxo horizontal com os sete passos. A [versão detalhada](pseudocodigo.md) explica o objetivo da busca e as restrições.

**Termos em uma frase:** `1.5-opt` reorganiza visitas dentro de uma rota. “Recuperar pendências” é tentar encaixar visitas que ainda não receberam dia. “Replanejar” é calcular nova agenda após uma ausência registrada.

## Slide 5 — Como medimos a prioridade atendida a tempo

**Título pronto:** Quanto da prioridade foi atendida a tempo?

**Fórmula curta para copiar:**

```text
Prioridade atendida a tempo (%) =
100 × soma dos pesos das visitas feitas a tempo
      ÷ soma dos pesos de todas as visitas da demanda inicial
```

**Texto pronto:** “Cada visita tem peso sintético de 1 a 5. Somamos os pesos das visitas feitas a tempo e dividimos pela soma dos pesos de todas as visitas da demanda inicial. Se a visita já estava vencida antes da simulação, ela conta como feita a tempo somente quando ocorre no primeiro dia. Visitas pendentes ficam na soma de baixo.”

**Exemplo para copiar:** Três visitas têm pesos 1, 3 e 5. O total é 9 pontos. Só a visita de peso 5 foi feita a tempo. Resultado: **5 ÷ 9 = 55,56% da prioridade atendida a tempo**. Isso não significa 55,56% dos pacientes.

**Visual sugerido:** três pacientes com pesos 1, 3 e 5; destaque para o peso 5. A [definição](metricas.md) explica os demais indicadores.

## Slide 6 — Resultado principal

**Título pronto:** A heurística atende mais prioridade a tempo

**Big numbers para copiar:**

> **+9,65 pontos percentuais**, em média, de prioridade atendida a tempo frente ao vizinho mais próximo.
> **899 vitórias, 64 empates e 9 derrotas** em **972 pares** = 324 cenários × 3 probabilidades de ausência. Cada par compara os dois métodos no mesmo cenário e na mesma probabilidade de ausência.
> **0,55 dia a menos**, em média, de atraso controlável ponderado por prioridade nos mesmos 972 pares.

**Rodapé obrigatório:** “Médias da grade fatorial da US Restinga, com pacientes e ausências sintéticos e rotas a pé do OSRM.”

**Visual sugerido:** três cartões numéricos. Não trocar `p.p.` por `%`.

## Slide 7 — O que muda com 90 pacientes

**Título pronto:** O ganho diminui com a carga, mas persiste com 90 pacientes

| Pacientes | Ganho médio de prioridade atendida a tempo frente ao vizinho |
|---:|---:|
| 15 | +15,26 p.p. |
| 30 | +10,79 p.p. |
| 45 | +7,87 p.p. |
| **90** | **+4,68 p.p.** |

Cada linha reúne **243 pares**: três sementes × três áreas × três horizontes × três proporções de visitas vencidas × três probabilidades de ausência. O ganho é a média, em pontos percentuais, da diferença entre os métodos em cada par.

**Número para copiar:** Com **90 pacientes**, foram **243 pares** = 3 sementes × 3 áreas × 3 horizontes × 3 proporções de visitas vencidas × 3 probabilidades de ausência. A heurística venceu o vizinho mais próximo em **237 pares** e perdeu em **6**.

**Visual sugerido:** exportar do relatório interativo o gráfico **“Pacientes”** com métrica “Prioridade atendida a tempo” e comparador “Vizinho mais próximo”. Cada barra agrega área, horizonte, vencimentos e taxa de ausência.

## Slide 8 — O custo e a conclusão

**Título pronto:** Mais resposta no prazo exige avaliar o custo de caminhada

**Big numbers para copiar:**

> **+3,03% de caminhada média** com a heurística principal frente ao vizinho mais próximo, nos mesmos 972 pares. As médias foram **113,16 km** com a heurística e **109,83 km** com o vizinho. Conta: `(113,16 ÷ 109,83 − 1) × 100 = 3,03%`.
> **+0,90 ponto percentual de cobertura efetiva**, em média, nos mesmos 972 pares. Cobertura efetiva é a fração da demanda inicial que recebeu visita concluída.

**Texto pronto:** “A heurística atendeu mais prioridade a tempo. Na mesma grade, sua caminhada média foi 3,03% maior que a do vizinho mais próximo: 113,16 km contra 109,83 km por execução. Esse é o custo logístico observado nesta simulação.”

**Rodapé obrigatório:** “Eficiência simulada do algoritmo em um território e pacientes sintéticos; não é impacto clínico observado.”

## Slide opcional — Generalização geográfica

A [comparação territorial](../../experimentos/analise/porto-alegre-caminhada/resumo-slides.md) começou com **132 territórios**. Um foi excluído porque faltava caminho a pé completo. Restaram **131 territórios**, cada um com **30 pacientes sintéticos**. Cada território foi testado com três probabilidades de ausência e três estratégias: 131 × 3 × 3 = **1.179 execuções**. A prioridade atendida a tempo pela heurística foi, em média, **22,9% maior em termos relativos** que a do vizinho mais próximo: 34,63% contra 28,18%. É outro estudo; use slide separado.

## Slide opcional — Capacidade para 250 pacientes

**Título pronto:** Quanto tempo uma equipe leva para atender 250 pacientes?

**Desenho para copiar:** “Na US Restinga, simulamos 250 pacientes sintéticos e uma equipe de 300 minutos por dia. Os prazos das visitas ficam entre outubro de 2026 e janeiro de 2027. Primeiro medimos a capacidade em quatro meses. Depois demos a todos os métodos um prazo amplo de 12 meses. Os nove planos iniciais (3 sementes × 3 estratégias) incluem todas as 250 visitas. Comparamos quantos dias úteis cada método leva para concluir as visitas, inclusive quando há faltas.”

**Capacidade em quatro meses:** nos três cenários, a heurística planejou **249 a 250 visitas de 250**. O vizinho mais próximo planejou **241 a 243 de 250**. A regra de urgência planejou **246 a 248 de 250**. O teste usa a mesma jornada de 300 minutos por dia e os mesmos pacientes da comparação longa.

**Resultado para copiar:** “No estudo de 250 pacientes, todas as 27 execuções concluíram as 250 visitas. Comparando heurística e vizinho mais próximo nos mesmos nove pares (3 sementes × 3 probabilidades de ausência), a heurística terminou em média **5,56 dias úteis antes**: **88,11 contra 93,67 dias úteis**. Ela também caminhou **13,03% menos**: **1.134,87 km contra 1.304,91 km** por execução.”

**Legenda do gráfico sugerido:** dias úteis até concluir 250 visitas, com barras separadas para ausência de 0%, 5% e 10%. Para a heurística e o vizinho, as médias são respectivamente **87,67 contra 91,33**, **88,33 contra 93,00** e **88,33 contra 96,67 dias úteis**. Cada barra resume três sementes. O limite de 12 meses apenas permite que todos terminem.

**Leitura:** o limite de 12 meses serve para permitir a conclusão; o resultado principal é o tempo efetivamente usado. Use este estudo separado da grade fatorial de até 90 pacientes. [Dados e limites](../../experimentos/analise/longo-250-caminhada/resumo.md).

## Arquivos para conferência

- [Resumo fatorial](../../experimentos/analise/fatorial-caminhada/resumo.md): tabelas, vitórias e limites.
- [Relatório interativo](../../experimentos/analise/fatorial-caminhada/relatorio.html): gráficos exportáveis em PNG.
- [Métricas](metricas.md): fórmulas e unidades.
- [Pseudocódigo](pseudocodigo.md): funcionamento e replanejamento.
- [Desenho experimental](desenho-experimental.md): fatores, sementes e origem das distâncias.
- [Estudo de 250 pacientes](../../experimentos/analise/longo-250-caminhada/resumo.md): teste de capacidade em quatro meses e dias úteis até concluir todas as visitas.
