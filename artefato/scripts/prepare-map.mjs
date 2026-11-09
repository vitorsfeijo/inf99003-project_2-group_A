// Prepara a rede de caminhada de Porto Alegre usada pelo roteador interno (sem Docker).
// 1. Baixa o extrato OpenStreetMap da Região Sul (Geofabrik) para osm-data/, se ainda não existir.
// 2. Recorta o município e grava o grafo compacto em artefato/packages/server/map/.
// Uso, na raiz do repositório: npm run prepare-map   (acrescente -- --force para refazer o grafo)
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const serverDist = path.join(root, 'artefato', 'packages', 'server', 'dist');
const pbfUrl = 'https://download.geofabrik.de/south-america/brazil/sul-latest.osm.pbf';
const pbfPath = process.env.OSM_PBF_PATH ?? path.join(root, 'osm-data', 'sul-latest.osm.pbf');
const graphPath = process.env.WALK_GRAPH_PATH ?? path.join(root, 'artefato', 'packages', 'server', 'map', 'walk-graph-porto-alegre.bin');
const force = process.argv.includes('--force');

if (!fs.existsSync(path.join(serverDist, 'routing', 'walk-graph.js'))) {
  throw new Error('Compile o servidor antes: npm run build --prefix artefato/packages/server');
}
const { buildWalkGraphFromPbf, saveWalkGraph } = await import(pathToFileURL(path.join(serverDist, 'routing', 'walk-graph.js')).href);
const { PORTO_ALEGRE_BBOX } = await import(pathToFileURL(path.join(serverDist, 'routes', 'routing-provider.js')).href);

if (fs.existsSync(graphPath) && !force) {
  console.log(`A rede de caminhada já existe em ${graphPath}. Use -- --force para refazê-la.`);
  process.exit(0);
}

if (!fs.existsSync(pbfPath)) {
  fs.mkdirSync(path.dirname(pbfPath), { recursive: true });
  console.log(`Baixando ${pbfUrl} (cerca de 430 MB, apenas uma vez)…`);
  const response = await fetch(pbfUrl);
  if (!response.ok || !response.body) throw new Error(`Falha no download do mapa: HTTP ${response.status}.`);
  const partial = `${pbfPath}.part`;
  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(partial));
  fs.renameSync(partial, pbfPath);
}

console.log(`Gerando a rede de caminhada de Porto Alegre a partir de ${pbfPath}…`);
const started = Date.now();
const graph = buildWalkGraphFromPbf(pbfPath, { bbox: PORTO_ALEGRE_BBOX });
fs.mkdirSync(path.dirname(graphPath), { recursive: true });
saveWalkGraph(graph, graphPath);
console.log(`Pronto em ${((Date.now() - started) / 1000).toFixed(1)} s: ${graph.nodeCount} nós, ${graph.edgeCount} trechos → ${graphPath}`);
