# Diretrizes para Agentes de IA — `experimentos/`

Este é o guia único deste diretório, consolidando as instruções anteriormente divididas entre `AGENTS.md` e `AGENT.md`. Aplica-se em conjunto com o `AGENTS.md` da raiz.

## Rigor e integridade experimental

### Reprodutibilidade

- Toda geração sintética deve usar o PRNG determinístico `mulberry32(seed)`.
- Preserve as sementes dos benchmarks existentes: `cenario_folgado` = 42, `cenario_equilibrado` = 123 e `cenario_escasso` = 999.
- Não altere essas sementes como parte de manutenção rotineira. Uma revisão explícita do protocolo que exija a alteração deve documentar a razão e o impacto na comparação com resultados anteriores.

### Isonomia entre métodos

- Execute `main-heuristic`, `urgency-baseline` e `nearest-baseline` sobre as mesmas instâncias exatas.
- Preserve a mesma matriz de custos de caminhada, equipes, jornada máxima e calendário para todos os métodos comparados.
- Todo plano gerado deve passar pelo verificador do núcleo.

### Métricas e resultados

- Separe as métricas do plano previsto dos resultados efetivamente simulados após falhas ou ausências.
- Não omita cenários com cobertura inferior a 100%; registre falhas de capacidade na fila de visitas não alocadas.
- Visitas não realizadas devem permanecer como `missed`, preservando seu prazo original.
- Meça obrigatoriamente atraso acumulado (dias), deslocamento total (km), tempo de viagem (minutos), cobertura (%), utilização média da jornada (%) e tempo computacional (ms).
- Exporte os resultados fatoriais em CSV e JSON e gere o relatório de `analise/fatorial-caminhada/`.

## Verificação obrigatória

Com o OSRM de caminhada em execução e `OSRM_BASE_URL` definido:

```bash
npm run build --prefix artefato/packages/core
npm run build --prefix experimentos
npm run factorial --prefix experimentos
npm run factorial:report --prefix experimentos
```

Confira a consistência das métricas, o manifesto e a ausência de valores nulos ou `NaN`. Registre exclusões por falta de caminhos na rede.
