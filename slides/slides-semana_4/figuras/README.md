# Figuras da apresentação final

Cada figura tem um `.tex` e um PDF vetorial de mesmo nome. O número inicial é um identificador estável da figura, baseado na numeração anterior; ele pode diferir do slide atual após reordenar a apresentação. Os slides incluem somente os PDFs com `\includegraphics{figuras/nome.pdf}`; não é necessário executar TikZ para recompilar a apresentação.

`preambulo-figuras.tex` centraliza cores, estilos TikZ e tipografia. As figuras usam Beamer de 11 pt, como os slides; o pacote `preview` recorta a página ao desenho, sem cabeçalhos ou margens adicionais. Os desenhos permanecem independentes; dados e rótulos dos gráficos são atualizados com os resultados experimentais.

## Recompilar todas as figuras

Com `pdflatex` no PATH, execute a partir da pasta `slides-semana_4`:

```powershell
powershell -File figuras/compilar-figuras.ps1
```

O script funciona também quando chamado de outra pasta. Os PDFs atualizados ficam ao lado dos `.tex`; arquivos auxiliares e logs ficam em `build/`, ignorado pelo Git. A instalação automática de pacotes está desabilitada: Beamer, TikZ e preview devem estar disponíveis no MiKTeX/TeX Live.

## Recompilar uma figura

Execute dentro de `figuras/`, para que o preâmbulo compartilhado seja encontrado:

```powershell
pdflatex --disable-installer -interaction=nonstopmode -halt-on-error -output-directory=build 08-mapa-vila-ipiranga.tex
Copy-Item build/08-mapa-vila-ipiranga.pdf . -Force
```

Recompile o PDF correspondente sempre que editar um desenho ou o preâmbulo; os slides não recompilam as figuras automaticamente. Ao compartilhar a apresentação, inclua a subpasta `figuras/` com seus PDFs.

As figuras de evolução, 1.5-opt e definição de resposta pronta foram preservadas como fontes auxiliares, mas não são incluídas na apresentação principal. O slide de entregas usa `05-realizacoes-projeto.pdf`.

O exemplo visual do slide 8 usa a US Vila Ipiranga, a mesma amostra e rota da captura `../mvp-aps.png`. O arquivo `08-mapa-vila-ipiranga-dados.json` preserva o cenário e a rota exibidos. Os segmentos do desenho são esquemáticos; os custos vêm da matriz de caminhada do plano. O mapa anterior da Restinga foi preservado como fonte auxiliar, sem referência no documento principal. Os estudos fatorial e de 250 pacientes continuam usando a Restinga.

## Gráficos atualizados com caminhada

Os seis gráficos abaixo usam os resultados OSRM a pé / OpenStreetMap disponíveis em 08/10/2026. Os nomes das figuras anteriores foram mantidos para preservar as referências. O documento principal tem 22 slides.

| Figura | Slide | Fonte, a partir da raiz do repositório |
|---|---:|---|
| `15-resposta-pronta-porto-alegre` | 14 | `experimentos/analise/porto-alegre-caminhada/resumo-slides.md` |
| `16-custos-limites` | 15 | Mesma síntese territorial: atraso, caminhada e cálculo acumulado |
| `17-ganho-ausencias` | Auxiliar | Mesma síntese: ganho de prioridade por ausência, 131 territórios / 393 pares |
| `18-fatorial-demanda` | 16 | `experimentos/analise/fatorial-caminhada/resumo-fatores.csv`: linhas dinâmicas, vizinho, prioridade a tempo, fator `patientCount` |
| `18-fatorial-caminhada` | Auxiliar | `experimentos/analise/fatorial-caminhada/resumo.md`: médias de caminhada nos 972 pares |
| `19-tempo-250-pacientes` | 17 | `experimentos/resultados/longo-250-caminhada/dynamic.csv`: média de três sementes por método e taxa |

Os slides 14 e 17 comparam médias absolutas; o slide 16 mostra ganho principal menos vizinho em pontos percentuais. Na figura do slide 15, cada painel tem sua escala, base zero e valores absolutos nas barras. As figuras de ganho por ausência e de caminhada fatorial foram preservadas como fontes auxiliares, sem referência na apresentação principal. Os 131 territórios incluídos resultam de uma exclusão entre os 132 importados. O fatorial inclui 15/30/45/90 pacientes e 2.916 execuções. O longo usa jornada diferente, de 300 min/dia, e não deve ser agregado aos estudos de 240 min/dia. Definições, contagens, sinais e ressalvas estão no roteiro.
