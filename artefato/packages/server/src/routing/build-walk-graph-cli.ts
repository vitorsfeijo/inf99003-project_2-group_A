/**
 * CLI: constrói o grafo de caminhada a partir de um extrato OSM PBF e o grava
 * no formato binário lido por `loadWalkGraph`.
 *
 * Uso: node dist/routing/build-walk-graph-cli.js <entrada.osm.pbf> <saida.bin> [--bbox minLat,minLng,maxLat,maxLng]
 *
 * O recorte `--bbox` é opcional e permite partir de um extrato regional maior
 * (por exemplo, o "sul" da Geofabrik) mantendo só a área de interesse.
 */
import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildWalkGraphFromPbf, loadWalkGraph, saveWalkGraph, type BoundingBox } from './walk-graph.js';

const USAGE = 'Uso: node dist/routing/build-walk-graph-cli.js <entrada.osm.pbf> <saida.bin> [--bbox minLat,minLng,maxLat,maxLng]';

function parseBbox(text: string | undefined): BoundingBox {
  const values = (text ?? '').split(',').map(Number);
  if (values.length !== 4 || values.some(value => !Number.isFinite(value))) {
    throw new Error(`Recorte inválido "${text ?? ''}". ${USAGE}`);
  }
  const [minLat, minLng, maxLat, maxLng] = values;
  return { minLat, minLng, maxLat, maxLng };
}

function main(argv: string[]): void {
  const positional: string[] = [];
  let bbox: BoundingBox | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--bbox') bbox = parseBbox(argv[++i]);
    else if (argv[i].startsWith('--bbox=')) bbox = parseBbox(argv[i].slice('--bbox='.length));
    else positional.push(argv[i]);
  }
  if (positional.length !== 2) throw new Error(USAGE);
  const input = resolve(positional[0]);
  const output = resolve(positional[1]);

  const buildStart = performance.now();
  const graph = buildWalkGraphFromPbf(input, { bbox });
  const buildMs = performance.now() - buildStart;

  const saveStart = performance.now();
  saveWalkGraph(graph, output);
  const saveMs = performance.now() - saveStart;

  const loadStart = performance.now();
  const loaded = loadWalkGraph(output);
  const loadMs = performance.now() - loadStart;
  if (loaded.nodeCount !== graph.nodeCount || loaded.edgeCount !== graph.edgeCount) {
    throw new Error('Verificação falhou: o grafo relido difere do grafo gravado.');
  }

  const sizes = graph.meta.componentSizes;
  console.log(`Entrada: ${input}`);
  console.log(`Saída:   ${output} (${(statSync(output).size / 1024 / 1024).toFixed(1)} MB)`);
  console.log(`Nós: ${graph.nodeCount.toLocaleString('pt-BR')} | arestas (não dirigidas): ${graph.edgeCount.toLocaleString('pt-BR')}`);
  console.log(`Componentes mantidos: ${sizes.length} (maior: ${sizes[0]} nós; demais: ${sizes.slice(1).join(', ') || '-'})`);
  console.log(`Nós descartados em fragmentos < ${graph.meta.minComponentNodes} nós: ${graph.meta.droppedNodes}`);
  console.log(`Tempos: construção ${(buildMs / 1000).toFixed(1)} s | gravação ${saveMs.toFixed(0)} ms | releitura ${loadMs.toFixed(0)} ms`);
}

main(process.argv.slice(2));
