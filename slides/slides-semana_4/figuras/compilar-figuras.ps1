# Recompila os PDFs vetoriais; auxiliares ficam em build/.
$ErrorActionPreference = 'Stop'
$compilador = (Get-Command pdflatex -ErrorAction Stop).Source
Push-Location $PSScriptRoot
try {
    New-Item -ItemType Directory -Path 'build' -Force | Out-Null
    $fontes = Get-ChildItem -LiteralPath $PSScriptRoot -Filter '*.tex' |
        Where-Object { $_.Name -ne 'preambulo-figuras.tex' } |
        Sort-Object Name
    foreach ($fonte in $fontes) {
        for ($passagem = 1; $passagem -le 2; $passagem++) {
            & $compilador --disable-installer -interaction=nonstopmode -halt-on-error -output-directory=build $fonte.Name
            if ($LASTEXITCODE -ne 0) {
                throw "Falha ao compilar $($fonte.Name). Consulte build/$($fonte.BaseName).log."
            }
        }
        Copy-Item -LiteralPath (Join-Path 'build' ($fonte.BaseName + '.pdf')) -Destination $PSScriptRoot -Force
        Write-Output "Compilado: $($fonte.BaseName).pdf"
    }
}
finally {
    Pop-Location
}
