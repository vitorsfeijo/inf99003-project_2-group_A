# Bancada de Experimentos e Avaliação — Pesquisa INF99003

Este diretório contém os scripts de **geração de dados sintéticos, simulação em lote e análise de resultados** utilizados para responder às perguntas de pesquisa do projeto (Ciclo 2 - INF99003).

---

## 📂 Estrutura de Módulos

```text
experimentos/
├── package.json
├── tsconfig.json
├── src/            # Código-fonte TypeScript da bancada experimental
├── cenarios/       # Arquivos JSON dos cenários gerados (folgado, equilibrado, escasso)
├── resultados/     # Datasets de saída da simulação em CSV e JSON
└── analise/        # Relatórios e gráficos comparativos
```

---

## 🔬 Protocolo Experimental e Reprodutibilidade

1. **Preparação Sintética:**
   * Utiliza o algoritmo *Mulberry32* com semente determinística.
   * Cria instâncias controladas variando o número de pacientes ($n$), número de equipes ($m$), janela móvel ($N$) e taxa de visitas vencidas.
   * Garante que cenários sejam 100% reproduzíveis.

2. **Execução em Lote:**
   * Submete exatamente o mesmo cenário e calendário a todas as estratégias comparadas:
     - `main-heuristic` (Heurística Principal + 1.5-opt)
     - `urgency-baseline` (Baseline por Urgência)
     - `nearest-baseline` (Baseline por Vizinho Mais Próximo)
   * Mede de forma isolada:
     - **Atraso Acumulado** (dias totais de atraso ao longo do horizonte)
     - **Deslocamento Total** (km)
     - **Tempo de Viagem** (minutos)
     - **Utilização e Desequilíbrio de Carga**
     - **Tempo Computacional de Execução** (ms)

3. **Relatórios e Visualização de Dados (`analise/`):**
   * Produz o arquivo interativo [experimentos/analise/relatorio_experimentos.html](file:///c:/Users/vitor/Documents/uni/pci/inf99003-project_2-group_A/experimentos/analise/relatorio_experimentos.html) alimentado com *Chart.js*.
   * Exporta datasets brutos em CSV ([experimentos/resultados/benchmark_results.csv](file:///c:/Users/vitor/Documents/uni/pci/inf99003-project_2-group_A/experimentos/resultados/benchmark_results.csv)) para análise estatística externa.

---

## 🚀 Como Executar os Experimentos

### Varredura fatorial para apresentação

O [protocolo fatorial](PROTOCOLO_FATORIAL.md) varia independentemente **pacientes, área do território, horizonte de planejamento, proporção inicialmente vencida e chance de falha**. As taxas de falha são **0%, 5% e 10% por tentativa**. O experimento completo usa três sementes, uma equipe e o território GeoSaúde US Restinga como geometria base; as versões de área reduzida ou ampliada são cenários sintéticos de sensibilidade. Os três métodos recebem exatamente os mesmos casos. Os arquivos de saída e o relatório são gerados com:

```bash
npm run build --prefix artefato/packages/core
npm run build --prefix experimentos
npm run factorial --prefix experimentos
npm run factorial:report --prefix experimentos
```

Abra [o relatório fatorial](analise/fatorial/relatorio.html) e use [o resumo para apresentação](analise/fatorial/resumo.md). Os resultados brutos ficam em `resultados/fatorial/` e podem ser regenerados com os comandos acima.

### Territórios GeoSaúde

Exporte **GeoJSON WGS84 (EPSG:4326), KML ou KMZ completo** do GeoSaúde. O arquivo completo usado para os cenários versionados está em `dados/GEOSAUDE - Território Base (Jul25) (1).kmz`; o SHA-256 aparece em cada arquivo de `provenance/`. As outras exportações locais em `dados/` são auxiliares e não são versionadas. Arquivos KMZ que contêm somente `NetworkLink` não incluem as áreas e são rejeitados. O gerador percorre a camada **Territórios da Atenção Primária**, cria um cenário separado por território e associa a unidade de saúde por nome exato. No arquivo de julho de 2025, 131 das 132 áreas têm associação exata; a área `US Ramos` usa a unidade mais próxima do centro geométrico e essa aproximação fica registrada na proveniência. Cada cenário usa **uma equipe**, um mês corrido a partir da data inicial (22 dias úteis em outubro de 2026) e 30 atendimentos sintéticos por padrão: 3.960 pessoas no conjunto, distribuídas entre as 132 áreas. A distribuição é uniforme dentro dos polígonos e não representa endereços reais, densidade populacional, prevalência clínica ou efetivo observado das equipes. Para estimar demanda proporcional à população, ainda são necessários setores censitários, contagens populacionais e parâmetros clínicos observados.

```bash
npm run build --prefix artefato/packages/core
npm run build --prefix experimentos
cd experimentos
npm run generate:geosaude -- 'dados/GEOSAUDE - Território Base (Jul25) (1).kmz' --all 30 20261008
```

Para uma única área, defina `GEOSAUDE_TERRITORY_NAME='Nome exato da área'` e use `npm run generate:geosaude -- '/caminho/territorio.kmz' 30 20261008`. Para GeoJSON sem ponto de UBS, informe `GEOSAUDE_HC_LAT` e `GEOSAUDE_HC_LNG`. O planejamento mantém o limite de jornada da equipe; visitas excedentes permanecem como não alocadas. O GeoSaúde fornece territórios e unidades, não uma lista de pacientes.

O relatório mostra distribuição das visitas alocadas em faixas de atraso e as pendências em faixa separada. A cobertura ponderada é `soma dos pesos clínicos alocados / soma dos pesos clínicos de todas as visitas candidatas`; a versão pontual conta apenas as visitas até o prazo. **Resposta pronta** conta visitas já vencidas quando atendidas no primeiro dia e visitas futuras até seu prazo, sempre ponderadas pelo peso clínico. O **atraso controlável** multiplica pelo peso clínico somente os dias após `max(início da janela, prazo)`; pendências são censuradas no último dia. Assim a comparação não atribui ao planejador o atraso herdado antes da janela. A eficiência clínica por quilômetro é `soma dos pesos clínicos alocados / distância total estimada`; compare esta razão **junto** à cobertura e ao tempo por visita para não premiar um método que abandona parte da demanda. Distâncias e tempos de viagem do benchmark continuam estimativas Haversine, iguais para as três estratégias.

O relatório HTML incorpora uma cópia local do Chart.js 4.5.1 e abre sem conexão; a licença MIT está em `analise/vendor/LICENSE.chartjs.md`.

Na simulação dinâmica, a cobertura efetiva usa como denominador a demanda inicial completa, inclusive quem nunca recebeu tentativa de atendimento. Falhas são determinadas por um sorteio estável para `(cenário, paciente, dia)`; a taxa de falha define o limiar desse sorteio, garantindo a mesma ausência quando estratégias diferentes visitam a mesma pessoa no mesmo dia. O atraso efetivo inclui pacientes ainda pendentes até o último dia simulado.

Para rodar a geração de dados e a simulação em lote:

```bash
# Na raiz do repositório
npm run experiments

# Ou dentro da pasta experimentos
cd experimentos
npm run generate
npm run simulate
node analise/generate_html_charts.js
```
