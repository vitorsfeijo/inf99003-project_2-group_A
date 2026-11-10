# Como abrir a interface no seu computador

Você não precisa programar nem instalar Docker. Basta o Node.js. A rede de caminhada de Porto Alegre já vem com o projeto, e o servidor calcula as rotas a pé sozinho.

## 1. Instale o Node.js

Instale o **Node.js 22 ou superior** em <https://nodejs.org>. No Windows, também dá para usar o terminal:

```powershell
winget install OpenJS.NodeJS.LTS
```

Feche e abra o terminal de novo. O comando `node --version` deve mostrar `v22` ou um número maior.

## 2. Abra o aplicativo

**Windows:** na pasta do projeto, dê um duplo clique em **`Iniciar-Aplicativo.bat`**.

**macOS, Linux ou terminal do Windows:** na pasta do projeto, rode:

```bash
npm ci --prefix artefato   # só na primeira vez
npm run app
```

Na primeira vez, a instalação leva alguns minutos. Depois, o terminal mostra `Aplicativo pronto em http://localhost:3001` e o navegador abre nesse endereço. **Deixe o terminal aberto** enquanto usar o aplicativo. Para encerrar, pressione **Ctrl+C** ou feche a janela.

## 3. Use a interface

1. Em **Selecionar região real**, escolha um território GeoSaúde, por exemplo **US Restinga**.
2. Em **Amostrar pacientes**, comece com **15 a 30** pacientes e a semente `20261008`.
3. Em **Equipes, profissionais e folgas**, marque os **profissionais de cada equipe** (por exemplo, ACS + enfermagem, ou cirurgião-dentista + ACS) e quantos há de cada categoria (padrão 1). Você pode criar mais equipes, ajustar a jornada, a folga após cada visita e a margem nos prazos. Se quiser, clique em **Marcar área de risco no mapa** e marque os cantos da área.
4. Na aba **Pacientes**, ou clicando num paciente no mapa, você pode:
   - definir uma **âncora** (obrigatório no primeiro dia) ou um **prazo rígido** ("em até N dias úteis");
   - marcar as **categorias profissionais** que a visita exige;
   - informar quantos **profissionais** a visita exige (padrão 1; por exemplo, 2 para mobilizar um acamado);
   - **vincular** o paciente a uma equipe;
   - incluir um paciente que está **fora do contorno** do GeoSaúde mas pertence à unidade;
   - **transferir** o paciente para outra unidade;
   - **cadastrar** um paciente novo clicando no mapa.
5. Clique em **Gerar e comparar planos**. Veja as rotas no mapa e compare as estratégias na aba **Comparar planos**.
6. Na aba **Execução**, marque cada visita como concluída ou não realizada e clique em **Encerrar Dia e Replanejar**. A agenda é refeita a partir do próximo dia útil. Uma âncora não realizada continua obrigatória no dia seguinte.

Os pacientes, endereços e condições são simulados. Os territórios, as unidades e as ruas são reais.

## Se algo der errado

- **"A execução de scripts foi desabilitada"** (PowerShell): use `npm.cmd` no lugar de `npm`, ou rode uma vez `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`. O `Iniciar-Aplicativo.bat` não tem esse problema.
- **"Roteador de caminhada indisponível"**: o arquivo `artefato/packages/server/map/walk-graph-porto-alegre.bin` está faltando. Rode `npm run prepare-map`, que baixa o mapa (cerca de 430 MB) e gera a rede.
- **"O paciente X está a mais de 1000 m da malha de caminhada"**: o endereço sintético caiu longe de qualquer rua (comum nas ilhas e na zona rural). Remova o paciente na aba Pacientes ou amostre com outra semente.
- **Porta 3001 ocupada**: feche outra cópia do aplicativo ou inicie com outra porta. No Bash: `PORT=3002 npm run app`. No PowerShell: `$env:PORT=3002; npm.cmd run app`.

## Para desenvolvedores: OSRM externo (opcional)

O OSRM em Docker continua disponível para quem quiser comparar com o roteador interno ou reproduzir as matrizes da bancada de experimentos. Inicie-o com `bash artefato/scripts/start-walking-osrm.sh <mapa>.osm.pbf`. Depois rode o servidor com `ROUTER=osrm OSRM_BASE_URL=http://127.0.0.1:5000`. Com OSRM, as áreas de risco não são aplicadas.
