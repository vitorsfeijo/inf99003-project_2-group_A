# Protocolo da varredura fatorial

## Pergunta e desenho

Medir a sensibilidade da heurística principal frente ao vizinho mais próximo e à prioridade por urgência quando variam, separadamente e em todas as combinações, cinco atributos da operação. A unidade de comparação é a mesma instância de pacientes, polígono, equipe, calendário e chance de falha aplicada aos três métodos.

| Fator | Níveis | Como é alterado |
|---|---|---|
| Pacientes | 15, 30, 45 | Subconjuntos aninhados da mesma amostra de 45 pessoas por semente |
| Área | 0,5×, 1×, 2× | Coordenadas do polígono GeoSaúde US Restinga e dos pacientes são escaladas por `sqrt(fator)` em torno da UBS; 1× é o contorno original |
| Horizonte | 5, 10, 22 dias úteis | `planningHorizonDays` do mesmo cenário, com início em 2026-10-01 |
| Já vencidas no início | 0%, 25%, 50% | Mesmo sorteio por pessoa em cada semente, com limiares aninhados; proporção realizada pode diferir da nominal |
| Falha da tentativa | **0%, 5%, 10%** | Sorteio determinístico por paciente e dia durante a execução; falha preserva a pendência para replanejamento |

São `3⁵ = 243` combinações de fatores por semente e **três sementes** (`20261008`, `20261009`, `20261010`): 729 condições de execução. Como a falha ocorre na simulação após a geração do cenário, isso corresponde a 243 instâncias distintas, 729 planos iniciais (`243 × 3 métodos`) e 2.187 execuções dinâmicas (`243 × 3 taxas × 3 métodos`). Cada execução dinâmica acompanha todo o horizonte de 5, 10 ou 22 dias úteis e replaneja a cada dia. Não se usam testes estatísticos de independência entre observações: casos com a mesma semente compartilham pacientes e sorteios para reduzir ruído nas diferenças pareadas.

## Controles e construção

- Fonte geográfica: `cenarios/geosaude_us_restinga_20261106_30.json`, gerada do KMZ GeoSaúde versionado em `dados/`. A forma original do território é real; os pacientes são sintéticos. As geometrias 0,5× e 2× são apenas perturbações experimentais, não regiões oficiais.
- Uma equipe, 240 minutos de trabalho por dia, início em 2026-10-01, antecipação máxima de dois dias corridos. Nenhuma equipe adicional é introduzida quando cresce a demanda.
- Cada pessoa tem uma visita candidata. As visitas ainda não vencidas têm prazo de zero a quatro dias corridos após o início; as já vencidas têm prazo de um a dez dias antes. Intervalo de repetição de 60 dias, para evitar segunda visita dentro da janela mais longa.
- A prioridade clínica é o peso sintético de 1 a 5 da amostra base. Esse peso não corresponde a estratificação clínica observada. A capacidade diária e a duração dos atendimentos são iguais entre métodos.
- A distância do benchmark é Haversine e o tempo usa 4,5 km/h como velocidade de caminhada. **Não representa o caminho pelas ruas.** O cálculo OSRM da interface é uma avaliação diferente.
- O PRNG Mulberry32 tem semente fixa. Pacientes, perfis e prazos compartilham os mesmos sorteios entre níveis quando aplicável; a falha de uma pessoa no mesmo dia compartilha o mesmo sorteio entre métodos e entre probabilidades. O nível de 10% contém os eventos sorteados no nível de 5% para a mesma tentativa.

## Desfechos e leitura dos gráficos

O plano inicial mede cobertura, resposta pronta ponderada pela prioridade, atraso controlável, distância e tempo de cálculo previstos. A simulação dinâmica mede visitas **efetivamente concluídas**, cobertura efetiva e ponderada, atraso adicional acionável, distância percorrida inclusive quando o paciente estava ausente, e tempo acumulado de replanejamento. Pendências permanecem no denominador e acumulam atraso até o último dia simulado.

O relatório usa **ganhos pareados**: `principal − baseline` para coberturas e `baseline − principal` para atraso, distância e tempo. Portanto, ganho positivo favorece a heurística principal. Cada média marginal de um nível de fator agrega todas as combinações dos demais fatores com a mesma quantidade de repetições. O CSV inclui média, mediana, quartis e número de vitórias, empates e derrotas; a mediana e os quartis mostram dispersão sem supor distribuição normal. As taxas de falha representam chances por tentativa, não porcentagens garantidas de visitas perdidas.

## Saídas e reprodução

```bash
npm run build --prefix artefato/packages/core
npm run build --prefix experimentos
npm run factorial --prefix experimentos
npm run factorial:report --prefix experimentos
```

`resultados/fatorial/manifest.json` registra fatores, fonte, contagens e modelos de custo e área. `static.json/.csv` e `dynamic.json/.csv` guardam cada execução; são saídas regeneráveis e não entram no Git. `analise/fatorial/relatorio.html`, `resumo.md` e `resumo-fatores.csv` são materiais de apresentação versionados, gerados diretamente dos resultados brutos. Se código ou parâmetros mudarem, regenere todos os arquivos e registre a revisão no trabalho acadêmico.

## Limitações de validade

Os resultados descrevem desempenho em **um território de Porto Alegre com pacientes sintéticos** e áreas artificialmente escaladas. Não estimam benefício clínico real, cobertura populacional nem qualidade de endereços observados. As três sementes são repetições computacionais, não amostra aleatória de unidades de saúde; os intervalos entre quartis não são intervalos de confiança. Para extrapolar a outras unidades, é preciso repetir a grade em outros polígonos e incorporar demanda clínica, população, endereços e jornadas observadas. Tempos de execução dependem do equipamento e devem ser comparados somente dentro da mesma rodada.
