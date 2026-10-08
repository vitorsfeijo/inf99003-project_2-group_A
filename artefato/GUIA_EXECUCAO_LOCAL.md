# Como abrir a interface no seu computador

Você não precisa programar em TypeScript. Os comandos abaixo instalam as dependências, compilam o projeto e iniciam os serviços. Execute-os em um terminal macOS, Linux ou WSL2 no Windows. Mantenha os terminais indicados abertos enquanto usar a interface.

## 1. Prepare o computador

Instale **Git**, **Node.js 22 ou 24** e **Docker Desktop**. Abra o Docker Desktop e espere o programa indicar que o motor Docker está ativo. No Windows, abra um terminal **WSL2** com a integração do Docker Desktop habilitada; o script do projeto usa Bash.

Confira as instalações:

```bash
git --version
node --version
npm --version
docker --version
```

O comando `node --version` deve começar com `v22` ou `v24`.

## 2. Baixe o projeto e o mapa de Porto Alegre

No **terminal 1**, copie os comandos, um bloco por vez:

```bash
git clone https://github.com/vitorsfeijo/inf99003-project_2-group_A.git
cd inf99003-project_2-group_A
mkdir -p osm-data
curl --fail --location https://download.bbbike.org/osm/bbbike/PortoAlegre/PortoAlegre.osm.pbf --output osm-data/PortoAlegre.osm.pbf
```

O arquivo `.osm.pbf` contém os caminhos do OpenStreetMap para Porto Alegre. Ele não vem no repositório porque é um arquivo de mapa. A fonte é o [extrato de Porto Alegre da BBBike](https://download.bbbike.org/osm/bbbike/PortoAlegre/). Se o grupo compartilhar o arquivo `PortoAlegre.osm.pbf` usado nos experimentos, você pode colocá-lo em `osm-data/` no lugar do download; assim usará a mesma versão do mapa.

## 3. Inicie o servidor de rotas a pé

Ainda no **terminal 1**, dentro da pasta do projeto:

```bash
bash artefato/scripts/start-walking-osrm.sh osm-data/PortoAlegre.osm.pbf
```

O script usa Docker para preparar o mapa com o perfil de caminhada `foot.lua` e, ao final, mantém o OSRM ativo na porta **5000**. A primeira preparação pode demorar alguns minutos. **Deixe este terminal aberto.**

## 4. Inicie a aplicação

Abra o **terminal 2** e entre na mesma pasta do projeto:

```bash
cd inf99003-project_2-group_A
npm ci --prefix artefato
OSRM_BASE_URL=http://127.0.0.1:5000 npm start
```

O `npm ci` instala as dependências. O `npm start` compila o código e inicia a API na porta **3001** e a interface na porta **3000**. A variável `OSRM_BASE_URL` precisa estar no mesmo comando que inicia a aplicação; não é um campo para preencher no navegador. **Deixe este terminal aberto.**

Se você abriu o terminal 2 em outra pasta, vá até a pasta clonada antes de executar esses comandos. Uma forma de conferir é rodar `ls`: você deve ver `artefato`, `experimentos` e `README.md`.

## 5. Confira e use a interface

No **terminal 3**, confira a conexão entre a API e o OSRM:

```bash
curl http://localhost:3001/api/routing-status
```

O resultado esperado é `{"walkingNetworkConfigured":true}`. Abra **http://localhost:3000** no navegador. Se a página já estava aberta, clique em **Verificar novamente** no aviso da imagem ou recarregue a página.

Na interface:

1. Em **Selecionar região real**, escolha um território GeoSaúde, por exemplo **US Restinga**.
2. Em **Amostrar pacientes**, comece com **15** pacientes e mantenha a semente `20261008`. Clique em **Amostrar no território**.
3. Em **Gerar e comparar os planos**, escolha a estratégia que deseja exibir e clique em **Gerar e comparar planos**. A aplicação calcula as três estratégias para comparação.
4. Abra **Comparar planos** para ver os indicadores. Use **Ver rotas no mapa** para ver um plano no mapa.

A interface cria um cronograma de **um mês** com pacientes sintéticos. O estudo de 250 pacientes e 12 meses é executado pela bancada de experimentos, não por essa tela.

## Se aparecer o aviso da imagem

O aviso significa que a API não conseguiu confirmar o servidor de caminhada.

- Confira se o Docker Desktop está ativo e se o **terminal 1** chegou à etapa `osrm-routed` sem erro.
- Confira se o **terminal 2** continua rodando e foi iniciado com `OSRM_BASE_URL=http://127.0.0.1:5000`.
- Rode novamente `curl http://localhost:3001/api/routing-status`. Se o resultado for `false`, confira o terminal 1. Se você iniciou o terminal 2 sem `OSRM_BASE_URL`, pare a aplicação com **Ctrl+C** e execute novamente o comando completo da etapa 4.
- Se a API não responder, leia o erro mostrado no terminal 2. Use Node.js 22 ou 24 e rode `npm ci --prefix artefato` dentro da pasta do projeto.
- Quando o status for `true`, clique em **Verificar novamente** na interface.

Para encerrar, pressione **Ctrl+C** nos terminais 2 e 1.
