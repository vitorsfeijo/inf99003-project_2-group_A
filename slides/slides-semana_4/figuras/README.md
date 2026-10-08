# Figuras da apresentação final

Cada figura tem um `.tex` e um PDF vetorial de mesmo nome. O número inicial é um identificador estável da figura, baseado na numeração anterior; ele pode diferir do slide atual após reordenar a apresentação. Os slides incluem somente os PDFs com `\includegraphics{figuras/nome.pdf}`; não é necessário executar TikZ para recompilar a apresentação.

`preambulo-figuras.tex` centraliza cores, estilos TikZ e tipografia. As figuras usam Beamer de 11 pt, como os slides; o pacote `preview` recorta a página ao desenho, sem cabeçalhos ou margens adicionais. A extração preserva os desenhos, dados e textos originais.

## Recompilar todas as figuras

Com `pdflatex` no PATH, execute a partir da pasta `slides-semana_4`:

```powershell
powershell -File figuras/compilar-figuras.ps1
```

O script funciona também quando chamado de outra pasta. Os PDFs atualizados ficam ao lado dos `.tex`; arquivos auxiliares e logs ficam em `build/`, ignorado pelo Git. A instalação automática de pacotes está desabilitada: Beamer, TikZ e preview devem estar disponíveis no MiKTeX/TeX Live.

## Recompilar uma figura

Execute dentro de `figuras/`, para que o preâmbulo compartilhado seja encontrado:

```powershell
pdflatex --disable-installer -interaction=nonstopmode -halt-on-error -output-directory=build 08-mapa-restinga.tex
Copy-Item build/08-mapa-restinga.pdf . -Force
```

Recompile o PDF correspondente sempre que editar um desenho ou o preâmbulo; os slides não recompilam as figuras automaticamente. Ao compartilhar a apresentação, inclua a subpasta `figuras/` com seus PDFs.

As figuras de evolução, 1.5-opt e definição de resposta pronta foram preservadas como fontes auxiliares, mas não são incluídas na apresentação principal. O slide de entregas usa `05-realizacoes-projeto.pdf`.
