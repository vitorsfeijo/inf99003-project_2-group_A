# Experimentos com rotas a pé

A bancada compara `main-heuristic`, `urgency-baseline` e `nearest-baseline` com pacientes sintéticos e matrizes de distância e duração calculadas pela API Table do OSRM sobre a rede OpenStreetMap preparada com `foot.lua`. A mesma matriz, equipe, calendário e demanda são usados pelos três métodos. Cada plano passa por `verifyPlan`.

## Reproduzir

Inicie o servidor conforme [instruções do artefato](../artefato/README.md) e defina `OSRM_BASE_URL`. Na raiz do repositório:

```bash
npm run build --prefix artefato/packages/core
npm run build --prefix artefato/packages/server
npm run build --prefix experimentos
OSRM_BASE_URL=http://127.0.0.1:5000 npm run citywide:report --prefix experimentos
OSRM_BASE_URL=http://127.0.0.1:5000 npm run factorial --prefix experimentos
npm run factorial:report --prefix experimentos
```

O comando `OSRM_BASE_URL=http://127.0.0.1:5000 npm run experiments:all` executa as análises territorial e fatorial. O estudo de 250 pacientes tem os comandos próprios abaixo. As matrizes ficam em cache em `resultados/*-caminhada/matrices/`. Passe `-- --refresh-matrices` à simulação quando mudar o grafo OSRM. `npm run verify:walking-matrices --prefix experimentos` confere o cache contra o servidor ativo. Instâncias sem caminho completo entram em `exclusions.json` e não nas médias.

## Estudos e saídas

- [Varredura fatorial](PROTOCOLO_FATORIAL.md): são 324 cenários = 1 território base × 3 sementes × 4 quantidades de pacientes (15, 30, 45 e 90) × 3 versões de área desse território × 3 horizontes × 3 proporções de visitas vencidas. Cada cenário recebe 3 estratégias e 3 probabilidades de ausência. Veja o [resumo](analise/fatorial-caminhada/resumo.md), o [relatório](analise/fatorial-caminhada/relatorio.html) e os registros em `resultados/fatorial-caminhada/`.
- [Territórios de Porto Alegre](analise/porto-alegre-caminhada/resumo-slides.md): 132 áreas GeoSaúde importadas. Uma foi excluída por falta de caminho a pé completo. As 131 avaliadas têm 30 pacientes sintéticos por área; resultados em `resultados/porto-alegre-caminhada/`.
- [Estudo de 250 pacientes](analise/longo-250-caminhada/resumo.md): um território base, uma equipe de 300 minutos por dia e três sementes. Os prazos das visitas ficam entre outubro de 2026 e janeiro de 2027. Quatro meses medem a capacidade inicial. A comparação usa **12 meses, de outubro de 2026 a setembro de 2027**, como prazo amplo comum. São **261 dias de segunda a sexta**, sem retirar feriados. Todos os nove planos iniciais (3 sementes × 3 estratégias) devem incluir **250 de 250 visitas**. Medimos quantos dias úteis cada método leva para concluir todas elas, com probabilidades de ausência de 0%, 5% e 10%. São **27 execuções = 3 sementes × 3 estratégias × 3 probabilidades de ausência**. Os comandos estão abaixo.
- [Material para o colega montar os slides](../slides/apoio-banca/README.md): roteiro, números, métricas e pseudocódigo copiáveis.

Para reproduzir o estudo de 250 pacientes, execute na raiz do repositório, com o OSRM de caminhada ativo:

```bash
OSRM_BASE_URL=http://127.0.0.1:5000 node experimentos/scripts/probe-long-capacity.mjs
OSRM_BASE_URL=http://127.0.0.1:5000 npm run long-horizon --prefix experimentos
```

O primeiro comando calcula ou reutiliza as matrizes a pé e verifica os planos iniciais em quatro e 12 meses. O segundo simula as 27 execuções e grava os resultados em `resultados/longo-250-caminhada/`. A simulação refaz o plano após uma falta e termina quando a última visita inicial é concluída. A jornada de 300 minutos permite que os trajetos mais longos caibam em um dia. Com 240 minutos, alguns pacientes não cabem em nenhuma jornada, independentemente do prazo total.

Nos **9 pares** entre heurística e vizinho mais próximo (3 sementes × 3 probabilidades de ausência), a heurística terminou **5,56 dias úteis antes** em média: 88,11 contra 93,67 dias úteis. A caminhada média foi **13,03% menor**: 1.134,87 km contra 1.304,91 km por execução. As 27 execuções concluíram as 250 visitas. Esses números pertencem ao estudo longo; a grade fatorial tem outra carga e outro resultado de caminhada.

Pacientes, prioridades e faltas são simulados com PRNG Mulberry32 e sementes fixas. A cobertura efetiva usa a demanda inicial completa no denominador. Uma visita sem sucesso permanece pendente com seu prazo original; o replanejamento ocorre a cada dia útil. Os quilômetros e minutos representam trajetos previstos na rede de caminhada, não deslocamentos observados em campo. O mapa base do GeoSaúde descreve o território, mas os endereços dos pacientes são sintéticos.
