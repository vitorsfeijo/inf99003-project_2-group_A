# Pseudocódigo da estratégia de otimização

Esta é uma tradução para apresentação da implementação em [`main-heuristic.ts`](../../artefato/packages/core/src/strategies/main-heuristic.ts) e [`one-half-opt.ts`](../../artefato/packages/core/src/improvement/one-half-opt.ts). O núcleo recebe uma matriz de distâncias e tempos; no experimento a pé, ela vem do OSRM com perfil `foot.lua` sobre OpenStreetMap.

```text
PLANEJAR(cenário, matriz de caminhada):
    validar cenário e filtrar pacientes dentro do território
    gerar visitas candidatas e dias úteis da janela
    rotas ← VIZINHO_MAIS_PRÓXIMO_VIÁVEL(visitas, equipes, dias, matriz)

    # Etapa 1: reduzir deslocamento sem inserir novas visitas.
    para cada rota: aplicar 1.5-OPT
    até 80 movimentos:
        avaliar realocações e trocas de visitas entre dias
        aceitar a melhor melhoria viável de tempo e atraso ponderado
        respeitar jornada, prazo/antecipação e orçamento de caminhada
        aplicar 1.5-OPT nas rotas alteradas

    # Etapa 2: recuperar pendências e atender mais prioridade a tempo.
    ordenar pendências por maior prioridade e prazo mais cedo
    inserir cada pendência na posição e dia viáveis de menor custo
    fixar os orçamentos de tempo e distância após as inserções
    até 80 movimentos:
        avaliar realocações e trocas entre dias
        aceitar a melhor combinação de menor tempo, menor atraso
            e mais prioridades atendidas no prazo
        impedir queda da prioridade atendida a tempo já alcançada
        respeitar jornada, prazo/antecipação e orçamentos
        aplicar 1.5-OPT nas rotas alteradas
    se uma pendência de maior prioridade couber ao substituir uma visita
       de menor prioridade sem piorar as restrições, realizar a substituição
    tentar inserir novamente as pendências restantes

    calcular métricas e verificar formalmente o plano
    devolver rotas e visitas não alocadas
```

**1.5-opt dentro de uma rota:** tenta reinserir uma visita em outra posição (`1-point move`). Se não melhorar, tenta inverter um segmento (`2-opt`). Repete enquanto houver redução do tempo da rota e recalcula horários, tempo e distância. As duas operações são essenciais para chamar a melhoria local de 1.5-opt.

O limite de **80 movimentos em cada etapa** é um teto de iterações da busca local. Ele impede uma busca indefinida. Não é a quantidade de pacientes, visitas ou dias. A busca pode parar antes se não encontrar melhoria viável.

**Orçamento de caminhada** é o limite de tempo ou distância usado pela busca para aceitar uma mudança de rota. A jornada diária de 240 minutos inclui caminhada e atendimento. A busca só aceita rotas que caibam na jornada e respeitem prazo, antecipação e disponibilidade da equipe.

**Replanejamento diário:** a simulação executa apenas a rota do dia; uma visita com paciente ausente é registrada como `missed`, mantendo o prazo original. No dia útil seguinte, o cenário atualizado passa novamente por `PLANEJAR`. Uma falta nunca vira conclusão presumida.

Para um slide, a representação mais legível é: **matriz a pé → construção por proximidade → 1.5-opt → ajuste entre dias → recuperação de pendências → verificador**. Os pesos internos da função de busca são parâmetros de implementação sem calibração clínica; por isso, não são indicadores de resultado nem precisam aparecer nos slides.
