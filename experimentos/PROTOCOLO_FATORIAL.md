# Protocolo fatorial com caminhada

## Desenho

A mesma instância de pacientes, território, equipe, calendário e matriz OSRM de caminhada é submetida a três métodos: heurística principal, prioridade clínica e vizinho mais próximo. Os trajetos vêm da rede OpenStreetMap preparada com `foot.lua`.

| Fator | Níveis | Construção |
|---|---|---|
| Pacientes | 15, 30, 45, 90 | Subconjuntos aninhados da mesma amostra por semente |
| Área | 0,5×, 1×, 2× | Escala sintética em torno da UBS; 1× preserva o território base |
| Horizonte | 5, 10, 22 dias úteis | Mesma data inicial |
| Visitas já vencidas | 0%, 25%, 50% | Limiares de sorteio aninhados |
| Falha por tentativa | 0%, 5%, 10% | Sorteio estável por cenário, paciente e dia |

As três sementes são `20261008`, `20261009` e `20261010`. Cada semente reproduz o sorteio de pacientes, prazos e prioridades.

- **324 cenários distintos:** 1 território base × 3 sementes × 4 quantidades de pacientes × 3 versões de área do mesmo território × 3 horizontes × 3 proporções de visitas vencidas.
- **972 planos iniciais:** 324 cenários × 3 estratégias. O plano inicial é feito antes de simular ausências.
- **2.916 execuções dinâmicas:** 972 combinações de cenário e estratégia × 3 probabilidades de ausência. Cada execução percorre todos os dias úteis do seu horizonte e refaz a agenda a cada dia.

A geometria base é a US Restinga do GeoSaúde. Os tamanhos de área 0,5× e 2× são transformações sintéticas do território. Não são regiões adicionais nem territórios oficiais.

Uma equipe dispõe de 240 minutos por dia. Cada pessoa tem uma visita candidata, peso clínico sintético de 1 a 5, e prazo sorteado. O limite de antecipação é dois dias corridos. A capacidade, as durações, os sorteios e a matriz são iguais entre métodos. Ausências registram `missed` e preservam a pendência e o prazo.

## Métricas

O plano inicial mede cobertura, prioridade atendida a tempo, atraso controlável, distância e tempo de cálculo. “Prioridade atendida a tempo” é a soma dos pesos das visitas feitas a tempo dividida pela soma dos pesos de todas as visitas da demanda inicial. Visitas já vencidas contam como feitas a tempo se forem concluídas no primeiro dia. A simulação dinâmica mede visitas concluídas, cobertura efetiva, atraso adicional controlável, distância percorrida inclusive após visita frustrada e tempo acumulado de planejamento. Pendências permanecem no denominador e acumulam atraso até o fim da janela. Ganhos pareados são `principal − baseline` para cobertura e `baseline − principal` para atraso, distância e tempo.

Os casos da mesma semente compartilham pacientes e sorteios; as médias entre níveis não são observações independentes. A taxa de ausência é probabilidade por tentativa. Pacientes e prioridades não representam registros clínicos reais.

## Reprodução

Com `OSRM_BASE_URL` apontando para o servidor de caminhada:

```bash
npm run build --prefix artefato/packages/core
npm run build --prefix artefato/packages/server
npm run build --prefix experimentos
OSRM_BASE_URL=http://127.0.0.1:5000 npm run factorial --prefix experimentos
npm run factorial:report --prefix experimentos
```

O manifesto e os CSV/JSON ficam em `resultados/fatorial-caminhada/`; [resumo](analise/fatorial-caminhada/resumo.md), [CSV de fatores](analise/fatorial-caminhada/resumo-fatores.csv) e [relatório interativo](analise/fatorial-caminhada/relatorio.html) ficam em `analise/fatorial-caminhada/`. Use `-- --refresh-matrices` quando mudar o grafo. A lista de exclusões informa instâncias sem caminho completo.

## Limitações

A grade usa um território de Porto Alegre, pacientes e demanda sintéticos, e uma equipe fixa. As três sementes são repetições computacionais, não amostra de unidades de saúde. Os resultados não estimam benefício clínico real nem cobertura populacional. Tempos computacionais dependem do equipamento.
