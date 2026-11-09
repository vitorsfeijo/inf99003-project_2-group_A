/**
 * Roteador a pé autocontido sobre o `WalkGraph` (substitui o OSRM `foot`).
 *
 * - Snapping: cada ponto é projetado na aresta mais próxima da malha (como o
 *   OSRM faz com "phantom nodes"), usando um índice espacial em grade. O trecho
 *   reto entre o ponto e a projeção ("perna de acesso") é somado nas duas
 *   pontas, por haversine, à velocidade de caminhada do grafo.
 * - Caminho mínimo por PESO, onde peso = duração; arestas que tocam alguma área
 *   de risco têm o peso multiplicado por `riskPenaltyFactor`. Distância e duração
 *   devolvidas são as REAIS (sem penalidade) do caminho escolhido.
 * - Dijkstra com heap binário sobre arrays tipados e carimbos de geração, para
 *   não reinicializar vetores a cada busca; parada antecipada quando todos os
 *   nós-alvo foram fixados.
 */
import type { WalkGraph } from './walk-graph.js';
import {
  haversineMeters, metersPerDegreeLng, METERS_PER_DEGREE_LAT, preparePolygon, segmentTouchesPolygon,
  type PreparedPolygon,
} from './geo.js';

export interface LatLng { lat: number; lng: number }

/** Polígono (pode ser não convexo) que pedestres devem evitar. */
export interface RiskArea { id: string; name?: string; vertices: LatLng[] }

export interface RouterOptions {
  riskAreas?: RiskArea[];
  /** Multiplicador do peso das arestas em áreas de risco (padrão 25; deve ser ≥ 1). */
  riskPenaltyFactor?: number;
}

export interface WalkRouterSettings {
  /**
   * Distância máxima (m) entre um ponto e a malha para o snapping (padrão 1000).
   * Pontos mais distantes indicam, em geral, falta de cobertura do extrato OSM.
   */
  maxSnapMeters?: number;
  /**
   * Se verdadeiro, ancora os pontos apenas no maior componente conexo, garantindo
   * caminho entre todos os pares (ao custo de pernas de acesso mais longas para
   * pontos em componentes isolados). Padrão: falso, ou seja, ancora no componente
   * mais próximo e lança erro se dois pontos caírem em componentes diferentes.
   */
  mainComponentOnly?: boolean;
}

export interface WalkMatrix { distanceKm: number[][]; durationMinutes: number[][] }

export interface WalkRoute {
  distanceKm: number;
  durationMinutes: number;
  /** Polilinha [lat, lng] passando por todos os pontos de passagem, em ordem. */
  positions: [number, number][];
}

/** Projeção de um ponto sobre a aresta mais próxima da malha. */
export interface NetworkSnap {
  /** Ponto projetado sobre a aresta. */
  lat: number;
  lng: number;
  /** Comprimento da perna de acesso (ponto original → projeção), em metros. */
  offsetMeters: number;
  /** Extremidades da aresta (u < v) e posição relativa da projeção (0 = u, 1 = v). */
  from: number;
  to: number;
  fraction: number;
}

export const DEFAULT_RISK_PENALTY_FACTOR = 25;
export const DEFAULT_MAX_SNAP_METERS = 1000;
const GRID_CELL_METERS = 100;

/** Representação interna de um ponto ancorado na malha. */
interface Phantom {
  segment: number;
  u: number;
  v: number;
  /** Entrada de adjacência u → v (mesma duração/comprimento/penalidade nos dois sentidos). */
  slot: number;
  t: number;
  lengthM: number;
  durationS: number;
  accessM: number;
  lat: number;
  lng: number;
}

interface PenaltyMask { mask: Uint8Array | null; factor: number }

/** Grade uniforme em coordenadas projetadas (metros) com itens em CSR. */
interface Grid { start: Uint32Array; items: Uint32Array }

export class WalkRouter {
  private readonly graph: WalkGraph;
  private readonly maxSnapMeters: number;
  private readonly mainComponentOnly: boolean;
  private readonly walkingSpeedMps: number;

  // Projeção local equiretangular para o índice espacial.
  private readonly originLat: number;
  private readonly originLng: number;
  private readonly mPerDegLng: number;
  private readonly x: Float64Array;
  private readonly y: Float64Array;
  private readonly cols: number;
  private readonly rows: number;

  // Segmentos não dirigidos: extremidade de origem (u < v) e entrada de adjacência u → v.
  private readonly segmentU: Uint32Array;
  private readonly segmentSlot: Uint32Array;
  private readonly segmentGrid: Grid;
  private readonly nodeGrid: Grid;

  // Estado reutilizável do Dijkstra.
  private generation = 0;
  private readonly seenGen: Uint32Array;
  private readonly doneGen: Uint32Array;
  private readonly targetGen: Uint32Array;
  private readonly weight: Float64Array;
  private readonly distM: Float64Array;
  private readonly durS: Float64Array;
  private readonly pred: Int32Array;
  private readonly heapKey: Float64Array;
  private readonly heapNode: Uint32Array;
  private heapSize = 0;

  private cachedMaskKey = '';
  private cachedMask: PenaltyMask = { mask: null, factor: 1 };

  constructor(graph: WalkGraph, settings: WalkRouterSettings = {}) {
    if (graph.nodeCount === 0) throw new Error('Grafo de caminhada vazio.');
    this.graph = graph;
    this.maxSnapMeters = settings.maxSnapMeters ?? DEFAULT_MAX_SNAP_METERS;
    if (!(this.maxSnapMeters > 0)) throw new Error('maxSnapMeters deve ser positivo.');
    this.mainComponentOnly = settings.mainComponentOnly ?? false;
    this.walkingSpeedMps = (graph.meta.walkingSpeedKmh * 1000) / 3600;

    const n = graph.nodeCount;
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    for (let i = 0; i < n; i++) {
      const lat = graph.lat[i], lng = graph.lng[i];
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }
    this.originLat = minLat;
    this.originLng = minLng;
    this.mPerDegLng = metersPerDegreeLng((minLat + maxLat) / 2);
    this.x = new Float64Array(n);
    this.y = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      this.x[i] = (graph.lng[i] - minLng) * this.mPerDegLng;
      this.y[i] = (graph.lat[i] - minLat) * METERS_PER_DEGREE_LAT;
    }
    this.cols = Math.floor(((maxLng - minLng) * this.mPerDegLng) / GRID_CELL_METERS) + 1;
    this.rows = Math.floor(((maxLat - minLat) * METERS_PER_DEGREE_LAT) / GRID_CELL_METERS) + 1;

    // Segmentos canônicos (u < v).
    const segments = graph.edgeCount;
    this.segmentU = new Uint32Array(segments);
    this.segmentSlot = new Uint32Array(segments);
    let count = 0;
    for (let u = 0; u < n; u++) {
      for (let slot = graph.offsets[u]; slot < graph.offsets[u + 1]; slot++) {
        if (u < graph.targets[slot]) {
          if (count >= segments) throw new Error('Grafo de caminhada inconsistente: arestas não simétricas.');
          this.segmentU[count] = u;
          this.segmentSlot[count] = slot;
          count++;
        }
      }
    }
    if (count !== segments) throw new Error('Grafo de caminhada inconsistente: arestas não simétricas.');

    this.nodeGrid = this.buildGrid(n, (item, visit) => {
      visit(this.cellCol(this.x[item]), this.cellRow(this.y[item]));
    });
    this.segmentGrid = this.buildGrid(segments, (item, visit) => {
      const u = this.segmentU[item];
      const v = graph.targets[this.segmentSlot[item]];
      const c0 = this.cellCol(Math.min(this.x[u], this.x[v])), c1 = this.cellCol(Math.max(this.x[u], this.x[v]));
      const r0 = this.cellRow(Math.min(this.y[u], this.y[v])), r1 = this.cellRow(Math.max(this.y[u], this.y[v]));
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) visit(c, r);
    });

    this.seenGen = new Uint32Array(n);
    this.doneGen = new Uint32Array(n);
    this.targetGen = new Uint32Array(n);
    this.weight = new Float64Array(n);
    this.distM = new Float64Array(n);
    this.durS = new Float64Array(n);
    this.pred = new Int32Array(n);
    // Cada entrada de adjacência gera no máximo um push (quando sua origem é fixada) + 2 iniciais.
    this.heapKey = new Float64Array(graph.targets.length + 4);
    this.heapNode = new Uint32Array(graph.targets.length + 4);
  }

  // -------------------------------------------------------------------------
  // API pública
  // -------------------------------------------------------------------------

  /** Nó do grafo mais próximo do ponto e a distância até ele (m). */
  snap(point: LatLng): { node: number; offsetMeters: number } {
    this.assertPoint(point, 'informado');
    const px = (point.lng - this.originLng) * this.mPerDegLng;
    const py = (point.lat - this.originLat) * METERS_PER_DEGREE_LAT;
    let best = -1;
    let bestSq = Infinity;
    this.scanGrid(this.nodeGrid, px, py, item => {
      if (this.mainComponentOnly && this.graph.component[item] !== 0) return Math.sqrt(bestSq);
      const dx = this.x[item] - px, dy = this.y[item] - py;
      const sq = dx * dx + dy * dy;
      if (sq < bestSq) { bestSq = sq; best = item; }
      return Math.sqrt(bestSq);
    });
    if (best < 0 || Math.sqrt(bestSq) > this.maxSnapMeters) throw new Error(this.tooFarMessage(point));
    return { node: best, offsetMeters: haversineMeters(point.lat, point.lng, this.graph.lat[best], this.graph.lng[best]) };
  }

  /** Projeção do ponto sobre a aresta mais próxima da malha. */
  snapToNetwork(point: LatLng): NetworkSnap {
    const phantom = this.phantomFor(point, 'informado');
    return {
      lat: phantom.lat, lng: phantom.lng, offsetMeters: phantom.accessM,
      from: phantom.u, to: phantom.v, fraction: phantom.t,
    };
  }

  /**
   * Matrizes de distância (km) e duração (min) a pé entre todos os pares de pontos.
   * Diagonal = 0; assimetria permitida. Lança `Error` se algum par não tiver caminho.
   */
  matrix(points: LatLng[], options: RouterOptions = {}): WalkMatrix {
    const count = points.length;
    const phantoms = points.map((point, index) => this.phantomFor(point, String(index)));
    const penalty = this.penaltyMask(options);
    const targetSet = new Set<number>();
    for (const phantom of phantoms) { targetSet.add(phantom.u); targetSet.add(phantom.v); }
    const targetNodes = Uint32Array.from(targetSet);

    const distanceKm: number[][] = [];
    const durationMinutes: number[][] = [];
    for (let i = 0; i < count; i++) {
      const distanceRow = new Array<number>(count).fill(0);
      const durationRow = new Array<number>(count).fill(0);
      const source = phantoms[i];
      this.search(source, targetNodes, penalty, false);
      for (let j = 0; j < count; j++) {
        if (i === j || (points[i].lat === points[j].lat && points[i].lng === points[j].lng)) continue;
        const target = phantoms[j];
        const leg = this.evaluateTarget(source, target, penalty);
        if (!leg) throw new Error(`Sem caminho a pé entre os pontos ${i} e ${j} (trechos desconectados da malha de caminhada).`);
        const meters = source.accessM + leg.distM + target.accessM;
        const seconds = (source.accessM + target.accessM) / this.walkingSpeedMps + leg.durS;
        if (!Number.isFinite(meters) || !Number.isFinite(seconds)) {
          throw new Error(`Sem caminho a pé entre os pontos ${i} e ${j}.`);
        }
        distanceRow[j] = meters / 1000;
        durationRow[j] = seconds / 60;
      }
      distanceKm.push(distanceRow);
      durationMinutes.push(durationRow);
    }
    return { distanceKm, durationMinutes };
  }

  /** Rota a pé passando pelos pontos na ordem dada, com a polilinha percorrida. */
  route(waypoints: LatLng[], options: RouterOptions = {}): WalkRoute {
    if (waypoints.length === 0) throw new Error('A rota a pé exige ao menos um ponto de passagem.');
    const phantoms = waypoints.map((point, index) => this.phantomFor(point, String(index)));
    const penalty = this.penaltyMask(options);
    const positions: [number, number][] = [];
    const pushPosition = (lat: number, lng: number) => {
      const last = positions[positions.length - 1];
      if (!last || last[0] !== lat || last[1] !== lng) positions.push([lat, lng]);
    };
    pushPosition(waypoints[0].lat, waypoints[0].lng);
    let meters = 0;
    let seconds = 0;
    for (let k = 1; k < phantoms.length; k++) {
      const a = waypoints[k - 1], b = waypoints[k];
      if (a.lat === b.lat && a.lng === b.lng) continue;
      const source = phantoms[k - 1];
      const target = phantoms[k];
      this.search(source, Uint32Array.of(target.u, target.v), penalty, true);
      const leg = this.evaluateTarget(source, target, penalty);
      if (!leg) throw new Error(`Sem caminho a pé entre os pontos ${k - 1} e ${k} (trechos desconectados da malha de caminhada).`);
      meters += source.accessM + leg.distM + target.accessM;
      seconds += (source.accessM + target.accessM) / this.walkingSpeedMps + leg.durS;
      pushPosition(source.lat, source.lng);
      if (leg.via >= 0) {
        const chain: number[] = [];
        for (let node = leg.via; node >= 0; node = this.pred[node]) chain.push(node);
        for (let c = chain.length - 1; c >= 0; c--) pushPosition(this.graph.lat[chain[c]], this.graph.lng[chain[c]]);
      }
      pushPosition(target.lat, target.lng);
      pushPosition(b.lat, b.lng);
    }
    return { distanceKm: meters / 1000, durationMinutes: seconds / 60, positions };
  }

  /** Diagnóstico: quantidade de arestas (não dirigidas) penalizadas pelas áreas de risco. */
  edgesInRiskAreas(options: RouterOptions = {}): number {
    const { mask } = this.penaltyMask(options);
    if (!mask) return 0;
    let total = 0;
    for (let s = 0; s < this.segmentSlot.length; s++) if (mask[this.segmentSlot[s]]) total++;
    return total;
  }

  // -------------------------------------------------------------------------
  // Snapping e índice espacial
  // -------------------------------------------------------------------------

  private cellCol(x: number): number { return Math.floor(x / GRID_CELL_METERS); }
  private cellRow(y: number): number { return Math.floor(y / GRID_CELL_METERS); }

  private buildGrid(itemCount: number, cellsOf: (item: number, visit: (col: number, row: number) => void) => void): Grid {
    const cellCount = this.cols * this.rows;
    const start = new Uint32Array(cellCount + 1);
    for (let item = 0; item < itemCount; item++) {
      cellsOf(item, (col, row) => { start[row * this.cols + col + 1]++; });
    }
    for (let c = 0; c < cellCount; c++) start[c + 1] += start[c];
    const cursor = start.slice(0, cellCount);
    const items = new Uint32Array(start[cellCount]);
    for (let item = 0; item < itemCount; item++) {
      cellsOf(item, (col, row) => { items[cursor[row * this.cols + col]++] = item; });
    }
    return { start, items };
  }

  /**
   * Varre a grade em anéis crescentes ao redor de (px, py). `visit` devolve a
   * melhor distância atual; a busca para quando nenhum anel seguinte pode ter
   * item mais próximo ou quando o raio excede `maxSnapMeters`.
   */
  private scanGrid(grid: Grid, px: number, py: number, visit: (item: number) => number): void {
    const col = this.cellCol(px);
    const row = this.cellRow(py);
    const maxRing = Math.ceil(this.maxSnapMeters / GRID_CELL_METERS) + 1;
    let best = Infinity;
    for (let ring = 0; ring <= maxRing; ring++) {
      for (let r = row - ring; r <= row + ring; r++) {
        if (r < 0 || r >= this.rows) continue;
        const onEdgeRow = r === row - ring || r === row + ring;
        const step = onEdgeRow || ring === 0 ? 1 : 2 * ring;
        for (let c = col - ring; c <= col + ring; c += step) {
          if (c < 0 || c >= this.cols) continue;
          const cell = r * this.cols + c;
          for (let k = grid.start[cell]; k < grid.start[cell + 1]; k++) best = visit(grid.items[k]);
        }
      }
      // Itens em anéis seguintes estão a pelo menos ring × célula de distância.
      if (best <= ring * GRID_CELL_METERS) return;
    }
  }

  private assertPoint(point: LatLng, label: string): void {
    if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) {
      throw new Error(`Ponto ${label} sem latitude/longitude numéricas.`);
    }
  }

  private tooFarMessage(point: LatLng, label = 'informado'): string {
    return `Ponto ${label} (${point.lat}, ${point.lng}) está a mais de ${this.maxSnapMeters} m da malha de caminhada ` +
      '(provavelmente fora da cobertura do extrato OSM usado para gerar o grafo).';
  }

  private phantomFor(point: LatLng, label: string): Phantom {
    this.assertPoint(point, label);
    const graph = this.graph;
    const px = (point.lng - this.originLng) * this.mPerDegLng;
    const py = (point.lat - this.originLat) * METERS_PER_DEGREE_LAT;
    let bestSegment = -1;
    let bestSq = Infinity;
    let bestT = 0;
    this.scanGrid(this.segmentGrid, px, py, segment => {
      const u = this.segmentU[segment];
      if (this.mainComponentOnly && graph.component[u] !== 0) return Math.sqrt(bestSq);
      const v = graph.targets[this.segmentSlot[segment]];
      const ax = this.x[u], ay = this.y[u];
      const dx = this.x[v] - ax, dy = this.y[v] - ay;
      const lengthSq = dx * dx + dy * dy;
      let t = lengthSq > 0 ? ((px - ax) * dx + (py - ay) * dy) / lengthSq : 0;
      if (t < 0) t = 0; else if (t > 1) t = 1;
      const qx = ax + t * dx - px, qy = ay + t * dy - py;
      const sq = qx * qx + qy * qy;
      if (sq < bestSq) { bestSq = sq; bestSegment = segment; bestT = t; }
      return Math.sqrt(bestSq);
    });
    if (bestSegment < 0 || Math.sqrt(bestSq) > this.maxSnapMeters) throw new Error(this.tooFarMessage(point, label));
    const u = this.segmentU[bestSegment];
    const slot = this.segmentSlot[bestSegment];
    const v = graph.targets[slot];
    const lat = graph.lat[u] + bestT * (graph.lat[v] - graph.lat[u]);
    const lng = graph.lng[u] + bestT * (graph.lng[v] - graph.lng[u]);
    return {
      segment: bestSegment, u, v, slot, t: bestT,
      lengthM: graph.lengthM[slot], durationS: graph.durationS[slot],
      accessM: haversineMeters(point.lat, point.lng, lat, lng), lat, lng,
    };
  }

  // -------------------------------------------------------------------------
  // Áreas de risco
  // -------------------------------------------------------------------------

  private penaltyMask(options: RouterOptions): PenaltyMask {
    const factor = options.riskPenaltyFactor ?? DEFAULT_RISK_PENALTY_FACTOR;
    if (!Number.isFinite(factor) || factor < 1) {
      throw new Error(`riskPenaltyFactor inválido (${factor}): deve ser um número finito ≥ 1.`);
    }
    const areas = options.riskAreas ?? [];
    if (areas.length === 0 || factor === 1) return { mask: null, factor: 1 };
    const key = `${factor}|${JSON.stringify(areas.map(area => area.vertices))}`;
    if (key === this.cachedMaskKey) return this.cachedMask;

    const polygons: PreparedPolygon[] = areas.map((area, index) =>
      preparePolygon(area.vertices, `"${area.name ?? area.id ?? index}"`));
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    for (const polygon of polygons) {
      minLat = Math.min(minLat, polygon.minLat); maxLat = Math.max(maxLat, polygon.maxLat);
      minLng = Math.min(minLng, polygon.minLng); maxLng = Math.max(maxLng, polygon.maxLng);
    }
    const graph = this.graph;
    const mask = new Uint8Array(graph.targets.length);
    for (let u = 0; u < graph.nodeCount; u++) {
      const latU = graph.lat[u], lngU = graph.lng[u];
      for (let slot = graph.offsets[u]; slot < graph.offsets[u + 1]; slot++) {
        const v = graph.targets[slot];
        const latV = graph.lat[v], lngV = graph.lng[v];
        // Pré-filtro pela caixa envolvente da união dos polígonos.
        if (Math.max(latU, latV) < minLat || Math.min(latU, latV) > maxLat ||
            Math.max(lngU, lngV) < minLng || Math.min(lngU, lngV) > maxLng) continue;
        for (const polygon of polygons) {
          if (segmentTouchesPolygon(polygon, latU, lngU, latV, lngV)) { mask[slot] = 1; break; }
        }
      }
    }
    this.cachedMaskKey = key;
    this.cachedMask = { mask, factor };
    return this.cachedMask;
  }

  // -------------------------------------------------------------------------
  // Dijkstra
  // -------------------------------------------------------------------------

  private heapPush(key: number, node: number): void {
    const keys = this.heapKey, nodes = this.heapNode;
    let i = this.heapSize++;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (keys[parent] <= key) break;
      keys[i] = keys[parent];
      nodes[i] = nodes[parent];
      i = parent;
    }
    keys[i] = key;
    nodes[i] = node;
  }

  /** Remove o topo do heap e devolve o nó (a chave do topo deve ser lida antes). */
  private heapPop(): number {
    const keys = this.heapKey, nodes = this.heapNode;
    const top = nodes[0];
    const size = --this.heapSize;
    if (size > 0) {
      const key = keys[size];
      const node = nodes[size];
      let i = 0;
      for (;;) {
        let child = 2 * i + 1;
        if (child >= size) break;
        if (child + 1 < size && keys[child + 1] < keys[child]) child++;
        if (keys[child] >= key) break;
        keys[i] = keys[child];
        nodes[i] = nodes[child];
        i = child;
      }
      keys[i] = key;
      nodes[i] = node;
    }
    return top;
  }

  private seed(node: number, weight: number, meters: number, seconds: number): void {
    const gen = this.generation;
    if (this.seenGen[node] === gen && this.weight[node] <= weight) return;
    this.seenGen[node] = gen;
    this.weight[node] = weight;
    this.distM[node] = meters;
    this.durS[node] = seconds;
    this.pred[node] = -1;
    this.heapPush(weight, node);
  }

  /** Dijkstra a partir de um ponto ancorado até fixar todos os `targets` (ou esgotar o componente). */
  private search(source: Phantom, targets: Uint32Array, penalty: PenaltyMask, trackPred: boolean): void {
    if (this.generation === 0xffffffff) {
      this.seenGen.fill(0); this.doneGen.fill(0); this.targetGen.fill(0);
      this.generation = 0;
    }
    const gen = ++this.generation;
    const graph = this.graph;
    const { offsets, targets: adjacency, lengthM, durationS } = graph;
    const { mask, factor } = penalty;
    const seenGen = this.seenGen, doneGen = this.doneGen, targetGen = this.targetGen;
    const weight = this.weight, distM = this.distM, durS = this.durS, pred = this.pred;

    let remaining = 0;
    for (let k = 0; k < targets.length; k++) {
      const node = targets[k];
      if (targetGen[node] !== gen) { targetGen[node] = gen; remaining++; }
    }

    this.heapSize = 0;
    const sourceFactor = mask && mask[source.slot] ? factor : 1;
    this.seed(source.u, source.t * source.durationS * sourceFactor, source.t * source.lengthM, source.t * source.durationS);
    const back = 1 - source.t;
    this.seed(source.v, back * source.durationS * sourceFactor, back * source.lengthM, back * source.durationS);

    while (this.heapSize > 0) {
      const key = this.heapKey[0];
      const x = this.heapPop();
      if (doneGen[x] === gen || key > weight[x]) continue;
      doneGen[x] = gen;
      if (targetGen[x] === gen && --remaining === 0) break;
      const wx = weight[x], dx = distM[x], sx = durS[x];
      for (let slot = offsets[x], end = offsets[x + 1]; slot < end; slot++) {
        const y = adjacency[slot];
        if (doneGen[y] === gen) continue;
        const seconds = durationS[slot];
        const candidate = wx + (mask !== null && mask[slot] === 1 ? seconds * factor : seconds);
        if (seenGen[y] !== gen || candidate < weight[y]) {
          seenGen[y] = gen;
          weight[y] = candidate;
          distM[y] = dx + lengthM[slot];
          durS[y] = sx + seconds;
          if (trackPred) pred[y] = x;
          this.heapPush(candidate, y);
        }
      }
    }
  }

  /**
   * Melhor chegada ao ponto-alvo após `search(source, ...)`: pela extremidade u,
   * pela extremidade v ou diretamente ao longo da mesma aresta. `via` é o último
   * nó do grafo no caminho (-1 = trecho direto na mesma aresta). Devolve `null`
   * se o alvo for inalcançável.
   */
  private evaluateTarget(source: Phantom, target: Phantom, penalty: PenaltyMask):
    { distM: number; durS: number; via: number } | null {
    const gen = this.generation;
    const targetFactor = penalty.mask && penalty.mask[target.slot] ? penalty.factor : 1;
    let bestWeight = Infinity;
    let best: { distM: number; durS: number; via: number } | null = null;
    if (this.doneGen[target.u] === gen) {
      const w = this.weight[target.u] + target.t * target.durationS * targetFactor;
      if (w < bestWeight) {
        bestWeight = w;
        best = { distM: this.distM[target.u] + target.t * target.lengthM, durS: this.durS[target.u] + target.t * target.durationS, via: target.u };
      }
    }
    if (this.doneGen[target.v] === gen) {
      const back = 1 - target.t;
      const w = this.weight[target.v] + back * target.durationS * targetFactor;
      if (w < bestWeight) {
        bestWeight = w;
        best = { distM: this.distM[target.v] + back * target.lengthM, durS: this.durS[target.v] + back * target.durationS, via: target.v };
      }
    }
    if (source.segment === target.segment) {
      const span = Math.abs(source.t - target.t);
      const w = span * target.durationS * targetFactor;
      if (w <= bestWeight) {
        best = { distM: span * target.lengthM, durS: span * target.durationS, via: -1 };
      }
    }
    return best;
  }
}
