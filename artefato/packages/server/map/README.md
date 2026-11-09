# Rede de caminhada de Porto Alegre

`walk-graph-porto-alegre.bin` é o grafo de caminhada usado pelo roteador interno do servidor (`src/routing/`). Ele permite calcular distâncias, tempos e traçados a pé sem Docker nem OSRM.

- **Fonte:** extrato OpenStreetMap da Região Sul do Brasil (Geofabrik, `sul-latest.osm.pbf`, baixado em 08/11/2026), recortado para o retângulo de latitude −30,30 a −29,92 e longitude −51,32 a −50,95.
- **Conteúdo:** 166.538 nós e 190.780 trechos de vias percorríveis a pé, com filtros próximos ao perfil `foot.lua` do OSRM. A velocidade é de 5 km/h, e de 2,5 km/h em escadas.
- **Licença:** © colaboradores do OpenStreetMap, dados disponíveis sob a [Open Database License (ODbL)](https://www.openstreetmap.org/copyright). O grafo é uma base derivada e segue a mesma licença.

Para atualizar o mapa, execute `npm run prepare-map -- --force` na raiz do repositório. O script baixa o extrato (cerca de 430 MB, guardado em `osm-data/`, que o git ignora) e regera este arquivo em cerca de 15 segundos.

O extrato da BBBike (`PortoAlegre.osm.pbf`) usado anteriormente termina na latitude −30,141. Ele não tem as ruas da Restinga, do extremo sul nem das ilhas, por isso não deve ser usado para esses territórios.
