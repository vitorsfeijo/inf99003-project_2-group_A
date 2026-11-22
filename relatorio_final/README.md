# Relatório final do PHVD-APS

Duas versões do mesmo trabalho, em LaTeX, para a prévia de 27/11/2026 e a apresentação final de 04/12/2026.

| Pasta | Versão | Formato |
|---|---|---|
| [relatorio_tecnico/](relatorio_tecnico/) | Relatório técnico de P&D do ciclo 3, no modelo enviado pela professora: problema, hipóteses e métricas, estruturas de dados, algoritmos e complexidade, protocolo experimental, resultados confrontados com as hipóteses, impacto (social, econômico, LGPD, ambiental), transferência tecnológica, lições aprendidas e guia de reprodutibilidade. | `article` do modelo, com `thebibliography` |
| [artigo/](artigo/) | Artigo científico: formulação do problema, algoritmo, desenho experimental com questões de pesquisa, resultados, discussão e ameaças à validade, com resumo em português e inglês. | IEEE de conferência (`IEEEtran`), duas colunas |

As figuras (capturas do aplicativo com pacientes sintéticos) ficam em [figuras/](figuras/). O artigo usa [referencias.bib](referencias.bib); o relatório técnico traz as referências no próprio `.tex`, como no modelo. Os números vêm dos resultados em `experimentos/` e dos testes do artefato.

No relatório técnico, os números de cartão e os e-mails ainda não preenchidos aparecem em vermelho no PDF (comando `\preencher`).

## Compilar

Em cada pasta, com MiKTeX ou TeX Live:

```bash
pdflatex relatorio_tecnico && pdflatex relatorio_tecnico
pdflatex artigo && bibtex artigo && pdflatex artigo && pdflatex artigo
```

Os PDFs compilados acompanham o repositório.
