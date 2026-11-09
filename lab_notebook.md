## Documentation of the development for Project 2 - INF99003

### 15-09-2026
- Papers organized in the /papers folder
- Started reading the papers

### 17-09-2026
- Two more papers on technology in APS were read
- Slides for the first-week checkpoint were prepared

### 23-09-2026
- Development plan assembled

### 24-09-2026
- New papers analised and organized in the /papers folder
- APS technological artifacts documented

### 29-09-2026
- Start of the implemetation of the APS artifact
- Experiments generation added of from the algorithms in the /experiments folder
- statistics and charts from the experiments added to the /results and /analise folder

### 08-10-2026
- A análise fatorial passou a usar trajetos a pé do OpenStreetMap por meio do OSRM. A grade contém 15, 30, 45 e 90 pacientes.
- No estudo de 250 pacientes, uma jornada de 240 minutos não permitia visitar alguns pacientes em nenhum dia: ida, atendimento e volta podiam exigir 265,6 minutos. Fixamos a jornada em 300 minutos para o teste de quatro meses e para a comparação longa.
- Em quatro meses, a heurística planejou 249 a 250 visitas de 250 nas três sementes. Com um limite de 12 meses, os nove planos iniciais (três sementes e três estratégias) incluíram todas as 250 visitas. A simulação compara os dias úteis até concluir as visitas, com 0%, 5% e 10% de ausência por tentativa.
- As 27 execuções terminaram com 250 visitas concluídas. Nos nove pares entre heurística e vizinho mais próximo, a heurística terminou 5,56 dias úteis antes em média (88,11 contra 93,67) e caminhou 13,03% menos (1.134,87 km contra 1.304,91 km por execução).
- Os slides para a apresentação final foi feita

### 25-10-2026 (continuação do projeto pelo novo grupo)
- Reproduzimos os três estudos com OSRM. O fatorial e o estudo de 250 pacientes bateram linha a linha com os resultados versionados. O territorial variou na segunda casa decimal (+6,42 contra +6,45 p.p.) por usar uma versão mais nova do mapa.
- `npm run long-horizon` reaproveita `dynamic.json` e `static.json` versionados; para reexecutar de fato é preciso apagá-los antes. O OSRM fecha conexões ociosas após 5 s e o `fetch` do Node falha em lotes longos; o script `start-walking-osrm.sh` passou a usar `--keepalive-timeout 3600`.

### 08-11-2026
- Implementamos os pedidos da equipe de saúde: âncoras e prazo rígido, categorias profissionais por equipe e por paciente, vínculo com equipe, inclusão fora do contorno, transferência entre unidades, áreas de risco, folga após cada visita e margem de segurança nos prazos.
- Criamos um roteador de caminhada interno, que dispensa o Docker. Numa comparação com o OSRM em 930 pares, a mediana de diferença foi de 1,0% no tempo e 0,1% na distância. A aplicação agora abre com `npm run app` ou com `Iniciar-Aplicativo.bat`.
- **Limitação encontrada:** o extrato da BBBike (`PortoAlegre.osm.pbf`) termina na latitude −30,141 e não cobre a Restinga, o extremo sul nem as ilhas. Nesses territórios, o OSRM encaixa os pacientes em poucas ruas a quilômetros de distância. Na matriz fatorial da Restinga, a distância do posto aos pacientes assume poucos valores repetidos (2,35 km e 8,67 km) e 34 de 210 pares de pacientes ficam a menos de 50 m. Os 265,6 minutos de ida e volta do estudo de 250 pacientes provavelmente vêm daí. A comparação entre métodos usou a mesma matriz, mas os quilômetros e o tempo de caminhada da Restinga não representam o bairro. A rede nova, gerada do extrato da Região Sul (Geofabrik), cobre 129 dos 132 territórios. As 3 exceções são pacientes sintéticos sorteados a mais de 1 km de qualquer via, nas ilhas e na zona rural.
- As restrições novas são opcionais. Sem elas, os três estudos reexecutados com as matrizes em cache reproduzem os resultados anteriores.
