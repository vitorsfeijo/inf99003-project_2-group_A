# Plano de desenvolvimento — framework de geração de rotas em TypeScript

## Objetivo e recorte

Implementar o pipeline apresentado nos slides da semana 2 como um framework reutilizável para planejar visitas domiciliares nos próximos `N` dias úteis. O núcleo deve funcionar sem interface, receber cenários em formato documentado, produzir planos verificáveis e permitir comparar métodos sob as mesmas entradas. Uma aplicação web mínima servirá para importar cenários, editar a localização dos pontos e regiões, visualizar rotas e registrar resultados reais.

O produto inicial é uma aplicação local de usuário único, com dados sintéticos ou pseudônimos. A interface web é a forma principal de uso; o núcleo não depende dela. Não estão previstos integração com prontuários, autenticação, publicação no npm ou navegação viária em tempo real.

## Arquitetura e contratos

Usar TypeScript em toda a aplicação, em três partes:

| Parte | Responsabilidade | Tecnologia proposta |
| --- | --- | --- |
| Núcleo | Validar, gerar demanda, calcular custos, planejar, melhorar, verificar e avaliar rotas | Pacote TypeScript sem dependência do navegador ou do banco |
| Servidor | Expor operações do núcleo, persistir cenários, eventos e versões, gerar arquivos de exportação | Node.js, Fastify e SQLite local |
| Interface | Importar JSON, ajustar geometria, consultar rotas e registrar visitas | React, Vite e Leaflet com base OpenStreetMap |

Definir esquemas compartilhados para `Scenario`, `VisitCandidate`, `CostMatrix`, `Plan`, `VisitResult` e `PlanMetrics`. O cenário conterá um posto, um ou mais polígonos, pacientes e condições, equipes e disponibilidade diária, calendário, `N`, antecipação máxima `A` e parâmetros de custo. O plano conterá rotas por dia e equipe, visitas não alocadas, custos, métricas, método utilizado e vínculo com a versão do cenário.

O núcleo exporá `planScenario(scenario, options)`, `applyVisitResults(state, results)` e `verifyPlan(scenario, plan)`. Cada método de roteamento implementará `RoutingStrategy`, receberá o mesmo estado já validado e devolverá o mesmo tipo de plano. As estratégias serão registradas por código na primeira versão, permitindo adicionar outras sem modificar o pipeline; não haverá carregamento dinâmico de código de terceiros.

## Pipeline de planejamento

1. **Validar entradas.** Conferir identificadores, datas, coordenadas, polígonos, intervalos, jornadas e parâmetros. Incluir pontos na borda dos polígonos e rejeitar cenários sem território válido. Pacientes fora da área não entram na otimização e aparecem no diagnóstico.
2. **Gerar demanda.** Calcular o prazo de cada condição pela última visita efetivamente concluída ou pelo prazo inicial informado. Agrupar condições atendidas na mesma visita, classificar visitas como vencidas, devidas hoje ou futuras e gerar recorrências condicionais apenas após visitas previstas. `N` conta dias úteis; prazos e `A` contam dias corridos.
3. **Montar grafo e custos.** Usar posto e casas elegíveis como vértices. Calcular matriz Haversine de distância e tempo por velocidade configurável, registrando os parâmetros para reprodução. A matriz de tempo determina a viabilidade da jornada; a distância é também uma métrica. O contrato aceitará outra matriz no futuro.
4. **Planejar.** Implementar baseline por urgência, baseline geográfico por vizinho viável mais próximo e heurística principal. Esta prioriza pendências e usa prazo, peso clínico configurado e custo incremental de inserção para escolher visita, dia, equipe e posição, permitindo antecipação somente dentro de `A`. Empates seguem identificadores estáveis. Visitas que não couberem ficam na fila com motivo.
5. **Melhorar e verificar.** Aplicar `1.5-opt` dentro de cada rota, sem trocar o dia das visitas. Conferir origem e retorno ao posto, unicidade, precedência temporal, território, disponibilidade e limite de jornada. Um plano inválido não será salvo como versão válida nem exibido como resultado.
6. **Avaliar e exportar.** Calcular cobertura, atraso, deslocamento, utilização e desequilíbrio das jornadas. Gerar CSV e GPX por equipe e dia, com pontos na ordem planejada. A linha exibida no mapa e no GPX será identificada como aproximação direta entre pontos, sem representar ruas.

## Replanejamento e persistência

Persistir no SQLite o cenário, os resultados reais e cada versão do plano com método, parâmetros e data de geração. Registrar uma visita como `concluída` ou `não realizada`, com motivo opcional. Só a conclusão altera a última visita real; uma falha conserva o prazo original e recoloca a visita na fila. Ao encerrar o dia, visitas sem resultado tornam-se `não realizadas` com motivo `não informado`.

Cada atualização cria uma nova versão: visitas executadas permanecem fixas, a parte ainda não executada do dia atual permanece planejada como estava, e os dias futuros são recalculados. Ao encerrar o dia, a janela avança para manter `N` dias úteis futuros. Recorrências condicionais afetadas por falhas ou conclusões em outra data são removidas e geradas novamente. A aplicação mostrará visitas remanejadas, novas pendências e rotas alteradas entre versões.

## Interface mínima

- Importar e validar um cenário JSON; oferecer exemplos sintéticos prontos para demonstrar o fluxo.
- Marcar ou corrigir posto e casas no mapa; desenhar, editar e remover polígonos; persistir as coordenadas.
- Selecionar dia e método; mostrar simultaneamente as rotas de todas as equipes, com cor estável, ordem das casas, legenda, duração, deslocamento e fila não alocada.
- Registrar resultados, encerrar o dia, consultar versões anteriores e baixar CSV/GPX.

Os demais campos do cenário poderão ser alterados no JSON importado. Formulários completos de cadastro ficam fora da primeira versão.

## Entregas e critérios de aceitação

| Etapa | Entrega | Evidência |
| --- | --- | --- |
| 1. Contratos e dados | Esquemas, exemplo JSON, gerador sintético com semente, validação, regras temporais e matriz de custos | Exemplo pequeno com prazos e replanejamento conferidos manualmente |
| 2. Framework | Três estratégias, `1.5-opt`, verificador, métricas e API independente da interface | Todos os métodos produzem planos válidos e mantêm visitas sem capacidade na fila |
| 3. Aplicação | Servidor, SQLite, mapa, importação, resultados, versões e exportação | Fluxo completo: importar → planejar → visualizar → registrar falha → replanejar → exportar |
| 4. Avaliação | Executor em lote e relatórios comparativos | Mesmas sementes, calendários e eventos para todos os métodos; métricas previstas e realizadas separadas |

Testar especialmente zero pacientes, ausência de equipe disponível, pontos fora do polígono, capacidade insuficiente, múltiplas condições, recorrência dentro da janela, falhas sucessivas, encerramento com visitas sem resultado e rejeição de plano inválido. Medir tempo e memória de geração e replanejamento. Comparar atraso acumulado e deslocamento com os baselines, sem presumir que a heurística seja superior.

## Premissas

Cada cenário usa um posto e equipes completas que percorrem juntas uma rota diária. A jornada disponível já desconta pausas e atividades administrativas. Prioridades clínicas e intervalos são parâmetros de entrada, não recomendações do software. Distâncias diretas e velocidade fixa são aproximações experimentais; eventual matriz viária exigirá medição e validação próprias.
