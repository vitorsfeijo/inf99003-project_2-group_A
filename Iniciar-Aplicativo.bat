@echo off
rem Abre o Planejamento de Visitas Domiciliares como aplicativo local (sem Docker).
rem Na primeira vez instala as dependencias e compila; depois apenas inicia.
chcp 65001 > nul
cd /d "%~dp0"
where node > nul 2>&1
if errorlevel 1 (
  echo Node.js nao encontrado. Instale o Node.js 22 ou superior: https://nodejs.org
  pause
  exit /b 1
)
if not exist "artefato\node_modules" (
  echo Instalando dependencias pela primeira vez...
  call npm.cmd ci --prefix artefato
  if errorlevel 1 goto erro
)
call npm.cmd run app
if errorlevel 1 goto erro
exit /b 0
:erro
echo.
echo Ocorreu um erro. Leia as mensagens acima.
pause
exit /b 1
