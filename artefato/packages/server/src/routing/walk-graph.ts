/**
 * Grafo de caminhada construído a partir de um extrato OSM PBF, aproximando o
 * perfil `foot.lua` do OSRM.
 *
 * Decisões documentadas:
 * - Velocidade de caminhada: 5 km/h (igual a `walking_speed` do foot.lua).
 * - Escadas (`highway=steps`): 2,5 km/h (o foot.lua usa 5 km/h; aqui reduzimos
 *   pela metade para refletir o esforço de subir/descer degraus).
 * - Superfícies lentas, como no foot.lua: `fine_gravel`, `gravel`, `pebblestone`
 *   a 0,75 × velocidade; `mud`, `sand` a 0,5 × velocidade (aplicado como mínimo).
 * - Todas as arestas são bidirecionais (pedestres ignoram `oneway`).
 * - Barreiras em nós (muros, cercas), balsas e restrições de conversão são ignoradas.
 * - Componentes conexos: mantemos apenas os componentes com pelo menos
 *   `MIN_COMPONENT_NODES` nós. Fragmentos isolados (calçadas de condomínios
 *   desconectadas, trechos cortados pelo recorte do extrato) são descartados, de
 *   modo que o snapping nunca cai neles. Componentes grandes porém separados
 *   (por exemplo, ilhas sem ligação a pé) são preservados; uma rota entre
 *   componentes diferentes gera erro explícito no roteador.
 *
 * Representação compacta: coordenadas em `Float64Array` e adjacência em CSR
 * (`offsets` + `targets` + comprimento em metros + duração em segundos), com
 * cada aresta não dirigida armazenada nos dois sentidos.
 */
import { endianness } from 'node:os';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { readOsmPbf } from './osm-pbf.js';
import { haversineMeters } from './geo.js';

/** Velocidade de caminhada padrão (km/h), igual à do foot.lua. */
export const WALKING_SPEED_KMH = 5;
/** Velocidade em escadas (km/h). */
export const STEPS_SPEED_KMH = 2.5;
/** Tamanho mínimo (em nós) para um componente conexo ser mantido no grafo. */
export const MIN_COMPONENT_NODES = 500;

/** Versão do formato binário gravado por `saveWalkGraph`. */
export const WALK_GRAPH_FORMAT_VERSION = 1;
const MAGIC = 'WLKGRAPH';

export interface WalkGraphMeta {
  formatVersion: number;
  source: string;
  builtAt: string;
  walkingSpeedKmh: number;
  stepsSpeedKmh: number;
  minComponentNodes: number;
  /** Quantidade de componentes conexos mantidos e o tamanho (nós) de cada um, em ordem decrescente. */
  componentSizes: number[];
  /** Nós descartados por pertencerem a fragmentos pequenos. */
  droppedNodes: number;
}

export interface WalkGraph {
  /** Quantidade de nós. */
  nodeCount: number;
  /** Quantidade de arestas não dirigidas (metade das entradas de adjacência). */
  edgeCount: number;
  lat: Float64Array;
  lng: Float64Array;
  /** CSR: as entradas de adjacência do nó `u` estão em `[offsets[u], offsets[u+1])`. */
  offsets: Uint32Array;
  targets: Uint32Array;
  /** Comprimento real de cada entrada de adjacência, em metros. */
  lengthM: Float32Array;
  /** Duração real de cada entrada de adjacência, em segundos. */
  durationS: Float32Array;
  /** Identificador do componente conexo de cada nó (0 = maior componente). */
  component: Uint16Array;
  meta: WalkGraphMeta;
}

// ---------------------------------------------------------------------------
// Filtro de vias (aproximação do foot.lua)
// ---------------------------------------------------------------------------

/** Vias percorríveis a pé por padrão. */
const DEFAULT_WALKABLE_HIGHWAYS = new Set([
  'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link',
  'unclassified', 'residential', 'road', 'living_street', 'service', 'track', 'path',
  'steps', 'pedestrian', 'footway', 'pier', 'platform', 'trunk', 'trunk_link',
]);
/** Valores de `foot` que liberam explicitamente o acesso de pedestres. */
const FOOT_ALLOWED = new Set(['yes', 'designated', 'permissive']);
/** Valores de acesso que bloqueiam pedestres (access_tag_blacklist do foot.lua). */
const ACCESS_BLOCKED = new Set(['no', 'private', 'agricultural', 'forestry', 'delivery']);
/** Vias nunca utilizáveis (em obras, planejadas, abandonadas). */
const HIGHWAY_BLOCKED = new Set(['construction', 'proposed', 'abandoned', 'razed', 'disused', 'impassable']);
const SURFACE_FACTOR: Record<string, number> = {
  fine_gravel: 0.75, gravel: 0.75, pebblestone: 0.75, mud: 0.5, sand: 0.5,
};

/**
 * Velocidade de caminhada (km/h) de um way, ou 0 se pedestres não podem usá-lo.
 * Hierarquia de acesso como no foot.lua: `foot` tem precedência sobre `access`.
 */
export function wayWalkingSpeedKmh(tags: Record<string, string>): number {
  const highway = tags.highway;
  const foot = tags.foot;
  const footAllowed = foot !== undefined && FOOT_ALLOWED.has(foot);
  const accessValue = foot ?? tags.access;
  if (accessValue !== undefined && ACCESS_BLOCKED.has(accessValue)) return 0;
  if (tags.impassable === 'yes') return 0;
  // Polígonos `area=yes` (praças, calçadões) entram como ways: o contorno é caminhável.

  let speed = 0;
  if (highway !== undefined) {
    if (HIGHWAY_BLOCKED.has(highway)) return 0;
    if (DEFAULT_WALKABLE_HIGHWAYS.has(highway)) speed = highway === 'steps' ? STEPS_SPEED_KMH : WALKING_SPEED_KMH;
    // motorway, cycleway, bridleway e demais valores só com foot=yes/designated/permissive.
    else if (footAllowed) speed = WALKING_SPEED_KMH;
  } else if (tags.railway === 'platform' || tags.man_made === 'pier' || tags.leisure === 'track' ||
             tags.amenity === 'parking' || tags.amenity === 'parking_entrance') {
    // Outras feições roteáveis do foot.lua sem etiqueta highway.
    speed = WALKING_SPEED_KMH;
  }
  if (speed === 0) return 0;
  const surfaceFactor = tags.surface !== undefined ? SURFACE_FACTOR[tags.surface] : undefined;
  if (surfaceFactor !== undefined) speed = Math.min(speed, WALKING_SPEED_KMH * surfaceFactor);
  return speed;
}

// ---------------------------------------------------------------------------
// Arrays tipados crescentes (evita arrays JS gigantes durante a leitura)
// ---------------------------------------------------------------------------

class GrowableFloat64 {
  data = new Float64Array(1 << 16);
  length = 0;
  push(value: number): void {
    if (this.length === this.data.length) {
      const next = new Float64Array(this.data.length * 2);
      next.set(this.data);
      this.data = next;
    }
    this.data[this.length++] = value;
  }
  view(): Float64Array { return this.data.subarray(0, this.length); }
}

class GrowableUint32 {
  data = new Uint32Array(1 << 16);
  length = 0;
  push(value: number): void {
    if (this.length === this.data.length) {
      const next = new Uint32Array(this.data.length * 2);
      next.set(this.data);
      this.data = next;
    }
    this.data[this.length++] = value;
  }
}

class GrowableFloat32 {
  data = new Float32Array(1 << 16);
  length = 0;
  push(value: number): void {
    if (this.length === this.data.length) {
      const next = new Float32Array(this.data.length * 2);
      next.set(this.data);
      this.data = next;
    }
    this.data[this.length++] = value;
  }
}

// ---------------------------------------------------------------------------
// Construção
// ---------------------------------------------------------------------------

function findRoot(parent: Int32Array, x: number): number {
  let root = x;
  while (parent[root] !== root) root = parent[root];
  while (parent[x] !== root) {
    const next = parent[x];
    parent[x] = root;
    x = next;
  }
  return root;
}

/** Retângulo geográfico em graus. */
export interface BoundingBox { minLat: number; minLng: number; maxLat: number; maxLng: number }

export interface BuildWalkGraphOptions {
  /**
   * Recorte opcional: só nós dentro do retângulo são carregados (útil para usar
   * um extrato regional grande, como o "sul" da Geofabrik, sem estourar memória).
   * Ways que cruzam a borda são cortados.
   */
  bbox?: BoundingBox;
}

/** Constrói o grafo de caminhada a partir de um arquivo `.osm.pbf`. */
export function buildWalkGraphFromPbf(pbfPath: string, options: BuildWalkGraphOptions = {}): WalkGraph {
  const bbox = options.bbox;
  if (bbox && !(bbox.minLat < bbox.maxLat && bbox.minLng < bbox.maxLng)) {
    throw new Error(`Recorte inválido: ${JSON.stringify(bbox)} (mínimos devem ser menores que máximos).`);
  }
  // 1) Leitura: nós (id + coordenadas, dentro do recorte) e os ways caminháveis.
  const nodeIds = new GrowableFloat64();
  const nodeLat = new GrowableFloat64();
  const nodeLng = new GrowableFloat64();
  const wayRefs = new GrowableFloat64();
  const wayStart = new GrowableUint32();
  const waySpeed = new GrowableFloat32();
  wayStart.push(0);

  let lastKeptId = -Infinity;
  let keptSorted = true;
  readOsmPbf(pbfPath, {
    node(id, lat, lng) {
      if (bbox && (lat < bbox.minLat || lat > bbox.maxLat || lng < bbox.minLng || lng > bbox.maxLng)) return;
      if (id <= lastKeptId) keptSorted = false;
      lastKeptId = id;
      nodeIds.push(id);
      nodeLat.push(lat);
      nodeLng.push(lng);
    },
    way(_id, refs, tags) {
      if (refs.length < 2) return;
      const speed = wayWalkingSpeedKmh(tags);
      if (speed <= 0) return;
      for (const ref of refs) wayRefs.push(ref);
      wayStart.push(wayRefs.length);
      waySpeed.push(speed);
    },
  });
  const osmNodeCount = nodeIds.length;
  if (osmNodeCount === 0) throw new Error(`O arquivo ${pbfPath} não contém nós OSM${bbox ? ' dentro do recorte' : ''}.`);
  const wayCount = waySpeed.length;
  if (wayCount === 0) throw new Error(`O arquivo ${pbfPath} não contém vias caminháveis.`);

  // 2) Índice ordenado por id para resolver referências por busca binária.
  const ids = nodeIds.view();
  let order: Uint32Array | null = null;
  if (!keptSorted) {
    const indices = Array.from({ length: osmNodeCount }, (_, index) => index);
    indices.sort((a, b) => ids[a] - ids[b]);
    order = Uint32Array.from(indices);
  }
  const sortedId = (position: number): number => ids[order ? order[position] : position];
  const lookup = (osmId: number): number => {
    let low = 0;
    let high = osmNodeCount - 1;
    while (low <= high) {
      const mid = (low + high) >>> 1;
      const value = sortedId(mid);
      if (value < osmId) low = mid + 1;
      else if (value > osmId) high = mid - 1;
      else return order ? order[mid] : mid;
    }
    return -1; // nó ausente (via cortada pelo recorte do extrato)
  };

  // 3) Resolve referências para índices de nós OSM e marca os nós usados.
  const refCount = wayRefs.length;
  const refs = wayRefs.view();
  const resolved = new Int32Array(refCount);
  const used = new Uint8Array(osmNodeCount);
  for (let i = 0; i < refCount; i++) {
    const index = lookup(refs[i]);
    resolved[i] = index;
    if (index >= 0) used[index] = 1;
  }
  const compact = new Int32Array(osmNodeCount).fill(-1);
  let usedCount = 0;
  for (let i = 0; i < osmNodeCount; i++) if (used[i]) compact[i] = usedCount++;

  // 4) Arestas não dirigidas entre nós consecutivos de cada way.
  const edgeU = new GrowableUint32();
  const edgeV = new GrowableUint32();
  const edgeLength = new GrowableFloat32();
  const edgeDuration = new GrowableFloat32();
  const latAll = nodeLat.view();
  const lngAll = nodeLng.view();
  for (let w = 0; w < wayCount; w++) {
    const speedMps = (waySpeed.data[w] * 1000) / 3600;
    for (let k = wayStart.data[w] + 1; k < wayStart.data[w + 1]; k++) {
      const a = resolved[k - 1];
      const b = resolved[k];
      if (a < 0 || b < 0 || a === b) continue;
      const length = haversineMeters(latAll[a], lngAll[a], latAll[b], lngAll[b]);
      edgeU.push(compact[a]);
      edgeV.push(compact[b]);
      edgeLength.push(length);
      edgeDuration.push(length / speedMps);
    }
  }
  const rawEdgeCount = edgeU.length;

  // 5) Componentes conexos (union-find) e filtro de fragmentos pequenos.
  const parent = new Int32Array(usedCount);
  for (let i = 0; i < usedCount; i++) parent[i] = i;
  for (let e = 0; e < rawEdgeCount; e++) {
    const ra = findRoot(parent, edgeU.data[e]);
    const rb = findRoot(parent, edgeV.data[e]);
    if (ra !== rb) parent[ra] = rb;
  }
  const rootSize = new Uint32Array(usedCount);
  for (let i = 0; i < usedCount; i++) rootSize[findRoot(parent, i)]++;
  const keptRoots: number[] = [];
  for (let i = 0; i < usedCount; i++) if (rootSize[i] >= MIN_COMPONENT_NODES) keptRoots.push(i);
  keptRoots.sort((a, b) => rootSize[b] - rootSize[a]);
  if (keptRoots.length === 0) throw new Error(`Nenhum componente com ao menos ${MIN_COMPONENT_NODES} nós em ${pbfPath}.`);
  if (keptRoots.length > 65535) throw new Error('Componentes demais para o formato do grafo de caminhada.');
  const componentOfRoot = new Int32Array(usedCount).fill(-1);
  keptRoots.forEach((root, index) => { componentOfRoot[root] = index; });

  const finalIndex = new Int32Array(usedCount).fill(-1);
  let nodeCount = 0;
  for (let i = 0; i < usedCount; i++) if (componentOfRoot[findRoot(parent, i)] >= 0) finalIndex[i] = nodeCount++;
  const lat = new Float64Array(nodeCount);
  const lng = new Float64Array(nodeCount);
  const component = new Uint16Array(nodeCount);
  for (let i = 0; i < osmNodeCount; i++) {
    const c = compact[i];
    if (c < 0) continue;
    const f = finalIndex[c];
    if (f < 0) continue;
    lat[f] = latAll[i];
    lng[f] = lngAll[i];
    component[f] = componentOfRoot[findRoot(parent, c)];
  }

  // 6) CSR com cada aresta nos dois sentidos.
  const degree = new Uint32Array(nodeCount + 1);
  let edgeCount = 0;
  for (let e = 0; e < rawEdgeCount; e++) {
    const u = finalIndex[edgeU.data[e]];
    if (u < 0) continue;
    const v = finalIndex[edgeV.data[e]];
    degree[u]++;
    degree[v]++;
    edgeCount++;
  }
  const offsets = new Uint32Array(nodeCount + 1);
  for (let i = 0; i < nodeCount; i++) offsets[i + 1] = offsets[i] + degree[i];
  const slotCount = offsets[nodeCount];
  const cursor = offsets.slice(0, nodeCount);
  const targets = new Uint32Array(slotCount);
  const lengthM = new Float32Array(slotCount);
  const durationS = new Float32Array(slotCount);
  for (let e = 0; e < rawEdgeCount; e++) {
    const u = finalIndex[edgeU.data[e]];
    if (u < 0) continue;
    const v = finalIndex[edgeV.data[e]];
    const length = edgeLength.data[e];
    const duration = edgeDuration.data[e];
    let slot = cursor[u]++;
    targets[slot] = v; lengthM[slot] = length; durationS[slot] = duration;
    slot = cursor[v]++;
    targets[slot] = u; lengthM[slot] = length; durationS[slot] = duration;
  }

  return {
    nodeCount,
    edgeCount,
    lat,
    lng,
    offsets,
    targets,
    lengthM,
    durationS,
    component,
    meta: {
      formatVersion: WALK_GRAPH_FORMAT_VERSION,
      source: basename(pbfPath) + (bbox ? ` [recorte ${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng}]` : ''),
      builtAt: new Date().toISOString(),
      walkingSpeedKmh: WALKING_SPEED_KMH,
      stepsSpeedKmh: STEPS_SPEED_KMH,
      minComponentNodes: MIN_COMPONENT_NODES,
      componentSizes: keptRoots.map(root => rootSize[root]),
      droppedNodes: usedCount - nodeCount,
    },
  };
}

// ---------------------------------------------------------------------------
// Formato binário
// ---------------------------------------------------------------------------
//
// Little-endian, seções alinhadas a 8 bytes:
//   0  "WLKGRAPH" (8 bytes ASCII)
//   8  uint32 versão do formato
//  12  uint32 nodeCount
//  16  uint32 slotCount (entradas de adjacência = 2 × arestas)
//  20  uint32 tamanho em bytes do JSON de metadados
//  24  JSON UTF-8 de metadados (WalkGraphMeta), preenchido até múltiplo de 8
//      lat Float64[n] | lng Float64[n] | offsets Uint32[n+1] | targets Uint32[s]
//      | lengthM Float32[s] | durationS Float32[s] | component Uint16[n]

const HEADER_BYTES = 24;
const align8 = (value: number): number => Math.ceil(value / 8) * 8;

function sectionLayout(nodeCount: number, slotCount: number, metaBytes: number) {
  let offset = align8(HEADER_BYTES + metaBytes);
  const lat = offset; offset += nodeCount * 8;
  const lng = offset; offset += nodeCount * 8;
  const offsets = offset; offset = align8(offset + (nodeCount + 1) * 4);
  const targets = offset; offset = align8(offset + slotCount * 4);
  const lengthM = offset; offset = align8(offset + slotCount * 4);
  const durationS = offset; offset = align8(offset + slotCount * 4);
  const component = offset; offset = align8(offset + nodeCount * 2);
  return { lat, lng, offsets, targets, lengthM, durationS, component, total: offset };
}

function assertLittleEndian(): void {
  if (endianness() !== 'LE') throw new Error('O formato do grafo de caminhada exige uma máquina little-endian.');
}

/** Grava o grafo em formato binário compacto. */
export function saveWalkGraph(graph: WalkGraph, filePath: string): void {
  assertLittleEndian();
  const metaBytes = Buffer.from(JSON.stringify(graph.meta), 'utf8');
  const slotCount = graph.targets.length;
  const layout = sectionLayout(graph.nodeCount, slotCount, metaBytes.length);
  const out = new Uint8Array(layout.total);
  const view = new DataView(out.buffer);
  for (let i = 0; i < MAGIC.length; i++) out[i] = MAGIC.charCodeAt(i);
  view.setUint32(8, WALK_GRAPH_FORMAT_VERSION, true);
  view.setUint32(12, graph.nodeCount, true);
  view.setUint32(16, slotCount, true);
  view.setUint32(20, metaBytes.length, true);
  out.set(metaBytes, HEADER_BYTES);
  const copy = (array: ArrayBufferView, offset: number) => {
    out.set(new Uint8Array(array.buffer, array.byteOffset, array.byteLength), offset);
  };
  copy(graph.lat, layout.lat);
  copy(graph.lng, layout.lng);
  copy(graph.offsets, layout.offsets);
  copy(graph.targets, layout.targets);
  copy(graph.lengthM, layout.lengthM);
  copy(graph.durationS, layout.durationS);
  copy(graph.component, layout.component);
  writeFileSync(filePath, out);
}

/** Lê um grafo gravado por `saveWalkGraph`, validando cabeçalho e consistência. */
export function loadWalkGraph(filePath: string): WalkGraph {
  assertLittleEndian();
  const file = readFileSync(filePath);
  // Garante alinhamento de 8 bytes para as views tipadas.
  const bytes = file.byteOffset % 8 === 0 ? file : new Uint8Array(file);
  const buffer = bytes.buffer;
  const base = bytes.byteOffset;
  if (bytes.length < HEADER_BYTES) throw new Error(`Arquivo de grafo ${filePath} truncado (cabeçalho incompleto).`);
  const magic = String.fromCharCode(...bytes.subarray(0, MAGIC.length));
  if (magic !== MAGIC) throw new Error(`Arquivo ${filePath} não é um grafo de caminhada (assinatura "${magic}").`);
  const view = new DataView(buffer, base, bytes.length);
  const version = view.getUint32(8, true);
  if (version !== WALK_GRAPH_FORMAT_VERSION) {
    throw new Error(`Grafo de caminhada ${filePath} na versão ${version}; esperada ${WALK_GRAPH_FORMAT_VERSION}. Reconstrua o arquivo.`);
  }
  const nodeCount = view.getUint32(12, true);
  const slotCount = view.getUint32(16, true);
  const metaLength = view.getUint32(20, true);
  const layout = sectionLayout(nodeCount, slotCount, metaLength);
  if (bytes.length < layout.total) {
    throw new Error(`Arquivo de grafo ${filePath} truncado: ${bytes.length} bytes, esperados ${layout.total}.`);
  }
  const meta = JSON.parse(Buffer.from(buffer, base + HEADER_BYTES, metaLength).toString('utf8')) as WalkGraphMeta;
  const graph: WalkGraph = {
    nodeCount,
    edgeCount: slotCount / 2,
    lat: new Float64Array(buffer, base + layout.lat, nodeCount),
    lng: new Float64Array(buffer, base + layout.lng, nodeCount),
    offsets: new Uint32Array(buffer, base + layout.offsets, nodeCount + 1),
    targets: new Uint32Array(buffer, base + layout.targets, slotCount),
    lengthM: new Float32Array(buffer, base + layout.lengthM, slotCount),
    durationS: new Float32Array(buffer, base + layout.durationS, slotCount),
    component: new Uint16Array(buffer, base + layout.component, nodeCount),
    meta,
  };
  if (graph.offsets[0] !== 0 || graph.offsets[nodeCount] !== slotCount) {
    throw new Error(`Grafo de caminhada ${filePath} inconsistente: índices de adjacência inválidos.`);
  }
  for (let i = 0; i < slotCount; i++) {
    if (graph.targets[i] >= nodeCount) throw new Error(`Grafo de caminhada ${filePath} inconsistente: aresta para nó inexistente.`);
  }
  return graph;
}
