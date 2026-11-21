# Relatório final do PHVD-APS

Duas versões do mesmo trabalho, em LaTeX, para a prévia de 27/11/2026 e a apresentação final de 04/12/2026.

| Pasta | Versão | Formato |
|---|---|---|
| [relatorio_tecnico/](relatorio_tecnico/) | Relatório técnico de inovação, como pedido pelos professores: problema, inovação, escuta dos stakeholders, funcionamento, avaliação, limitações e caminho de adoção. | `article`, citações ABNT autor-data (`abntex2cite`) |
| [artigo/](artigo/) | Artigo científico: formulação do problema, algoritmo, desenho experimental com questões de pesquisa, resultados, discussão e ameaças à validade, com resumo em português e inglês. | IEEE de conferência (`IEEEtran`), duas colunas |

As figuras (capturas do aplicativo com pacientes sintéticos) ficam em [figuras/](figuras/) e as referências em [referencias.bib](referencias.bib), compartilhadas pelas duas versões. Os números vêm dos resumos em `experimentos/analise/` e dos testes do artefato.

## Compilar

Em cada pasta (`relatorio_tecnico/` ou `artigo/`), com MiKTeX ou TeX Live:

```bash
pdflatex relatorio_tecnico && bibtex relatorio_tecnico && pdflatex relatorio_tecnico && pdflatex relatorio_tecnico
pdflatex artigo && bibtex artigo && pdflatex artigo && pdflatex artigo
```

Os PDFs compilados acompanham o repositório.
