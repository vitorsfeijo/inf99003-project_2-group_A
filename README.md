# Planejamento de Visitas Domiciliares de Equipes de Saúde (APS)

> **Artefato computacional e bancada de experimentos reproduzíveis** para apoiar o planejamento e replanejamento de rotas de visitas domiciliares na Atenção Primária à Saúde.

---

## 👥 Projeto e Integrantes

| Disciplina | Ciclo | Grupo |
| --- | --- | --- |
| **Projeto em Ciência e Inovação (INF99003)** | 2 | A |

* **Tobias Marion**
* **Vitor Feijo**
* **Fabio Cieslak**

---

## 📌 Contexto e Pergunta de Pesquisa

Equipes multiprofissionais de saúde (médico, enfermeiro e assistente social) precisam planejar visitas domiciliares periódicas em seus territórios de atuação. O planejamento deve respeitar as prioridades clínicas, a jornada diária máxima das equipes, o intervalo entre atendimentos e a localização geográfica dos pacientes.

* **Pergunta de pesquisa:** Em instâncias representativas de visitas domiciliares e falhas de atendimento, quanto uma heurística para uma janela móvel de $N$ dias melhora o atendimento das pendências, o atraso acumulado, o deslocamento e o tempo de execução em relação a regras simples de planejamento?
* **Hipótese:** Uma seleção orientada por urgência e prazos futuros, seguida de inserção de menor custo incremental e melhoria local **1.5-opt**, reduz o atraso acumulado após replanejamentos sem elevar excessivamente o deslocamento ou o tempo computacional.

O detalhamento da formulação, premissas e protocolização experimental estão em [plano_de_desenvolvimento.md](plano_de_desenvolvimento.md) e [plano_framework_roteamento_ts.md](plano_framework_roteamento_ts.md).

---

## 🗺️ Estrutura do Repositório

O repositório está organizado de forma a separar os materiais de redação acadêmica do código-fonte do programa e da bancada experimental:

```text
inf99003-project_2-group_A/
├── papers/                       # Fichamentos, resumos e bibliografia de APS e VRP
├── projeto_de_pesquisa/          # Redação formal do projeto de pesquisa
├── slides/                       # Apresentações de acompanhamento das semanas
├── lab_notebook.md               # Diário de bordo dos experimentos e decisões do grupo
├── plano_de_desenvolvimento.md   # Especificação formal do problema e premissas
├── plano_framework_roteamento_ts.md # Especificação do pipeline de software em TypeScript
│
├── artefato/                     # [CÓDIGO-FONTE DA APLICAÇÃO]
│   ├── packages/core/            # Núcleo isomórfico (Custo Inc + 1.5-opt + Verificador)
│   ├── packages/server/          # Backend Node.js, Fastify, SQLite e exportação CSV/GPX
│   └── packages/web/             # Interface gráfica React + Vite + Mapa Leaflet
│
└── experimentos/                 # [BANCADA DE EXPERIMENTAÇÃO DA PESQUISA]
    ├── src/                      # Código-fonte TypeScript da bancada experimental
    ├── cenarios/                 # Cenários sintéticos reproduzíveis (JSON)
    ├── resultados/               # Datasets de métricas em CSV e JSON
    └── analise/                  # Relatório interativo em HTML com gráficos (Chart.js)
```

---

## 🚀 Como Executar

### 1. Iniciar o Artefato Completo (Backend + Frontend) de uma só vez

Você pode iniciar o servidor backend (porta 3001) e a interface web (porta 3000) simultaneamente com um único comando na raiz:

```bash
npm start
```

Acesse no navegador: **`http://localhost:3000`**

### 2. Rodar a Bancada de Experimentos em Lote

Para gerar os cenários sintéticos com semente, executar a simulação em lote comparando os métodos e gerar o relatório com gráficos:

```bash
npm run experiments
```

O relatório interativo ficará disponível em: [experimentos/analise/relatorio_experimentos.html](file:///c:/Users/vitor/Documents/uni/pci/inf99003-project_2-group_A/experimentos/analise/relatorio_experimentos.html).

---

## 📄 Documentação Técnica e Diretrizes

* Documentação do Artefato: [artefato/README.md](artefato/README.md)
* Guia para Agentes de I.A. no Artefato: [artefato/AGENT.md](artefato/AGENT.md)
* Documentação dos Experimentos: [experimentos/README.md](experimentos/README.md)
* Guia para Agentes de I.A. nos Experimentos: [experimentos/AGENT.md](experimentos/AGENT.md)
* Bibliografia de Referência: [papers/_papers.md](papers/_papers.md) e [papers/artifacts.md](papers/artifacts.md) 
