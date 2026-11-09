import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Coordinates, CostMatrix, Scenario, isPointInPolygon, validateScenario } from '@routing/core';
import { buildWalkingCostMatrix } from './road-matrix.js';
import { buildWalkGraphFromPbf, loadWalkGraph, saveWalkGraph } from '../routing/walk-graph.js';
import { RouterOptions, WalkRouter } from '../routing/walk-router.js';

/**
 * Escolhe o cálculo de caminhada: o roteador interno (rede a pé do OpenStreetMap carregada
 * no próprio servidor, sem Docker, com desvio de áreas de risco) ou um OSRM externo.
 * `ROUTER=osrm` força o OSRM; sem o mapa preparado, o OSRM configurado é usado como alternativa.
 */
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const repositoryRoot = path.resolve(serverRoot, '../../..');
// Extrato da Região Sul (Geofabrik): o da BBBike para Porto Alegre termina na latitude -30,141 e não cobre a zona sul.
export const DEFAULT_PBF_PATH = process.env.OSM_PBF_PATH ?? path.join(repositoryRoot, 'osm-data', 'sul-latest.osm.pbf');
// Grafo já recortado para o município: poucos MB, distribuído com o projeto para dispensar o download do mapa.
export const DEFAULT_GRAPH_PATH = process.env.WALK_GRAPH_PATH ?? path.join(serverRoot, 'map', 'walk-graph-porto-alegre.bin');
export const PORTO_ALEGRE_BBOX = { minLat: -30.30, minLng: -51.32, maxLat: -29.92, maxLng: -50.95 };

let walkRouter: WalkRouter | undefined;
let walkRouterError = '';

export interface RoadRoute {
  distanceKm: number;
  durationMinutes: number;
  positions: [number, number][];
  riskAreasCrossed?: string[];   // Áreas de risco que o traçado ainda atravessa por falta de alternativa
}

/** Nomes das áreas de risco tocadas pelo traçado (o desvio é preferencial, não absoluto). */
function crossedRiskAreas(scenario: Scenario, positions: [number, number][]): string[] {
  return (scenario.riskAreas ?? [])
    .filter(area => positions.some(([lat, lng]) => isPointInPolygon({ lat, lng }, { id: area.id, name: area.name, vertices: area.vertices })))
    .map(area => area.name);
}

/** Carrega a rede a pé; na primeira execução, gera o grafo a partir do arquivo .osm.pbf. */
export function initWalkRouter(log: (message: string) => void): void {
  if (process.env.ROUTER === 'osrm') return;
  try {
    if (!fs.existsSync(DEFAULT_GRAPH_PATH)) {
      if (!fs.existsSync(DEFAULT_PBF_PATH)) {
        walkRouterError = `Mapa não encontrado em ${DEFAULT_PBF_PATH}. Execute "npm run prepare-map" na raiz do repositório.`;
        log(walkRouterError);
        return;
      }
      log('Preparando a rede de caminhada a partir do mapa OpenStreetMap (apenas na primeira execução)…');
      fs.mkdirSync(path.dirname(DEFAULT_GRAPH_PATH), { recursive: true });
      saveWalkGraph(buildWalkGraphFromPbf(DEFAULT_PBF_PATH, { bbox: PORTO_ALEGRE_BBOX }), DEFAULT_GRAPH_PATH);
    }
    walkRouter = new WalkRouter(loadWalkGraph(DEFAULT_GRAPH_PATH));
    log(`Roteador de caminhada interno carregado (${DEFAULT_GRAPH_PATH}).`);
  } catch (error) {
    walkRouterError = `Falha ao preparar o roteador interno: ${error instanceof Error ? error.message : String(error)}`;
    log(walkRouterError);
  }
}

function osrmBaseUrl(): string | undefined {
  return process.env.OSRM_BASE_URL?.replace(/\/$/, '');
}

export type RouterKind = 'internal' | 'osrm' | 'none';

export function activeRouter(): RouterKind {
  if (walkRouter) return 'internal';
  return osrmBaseUrl() ? 'osrm' : 'none';
}

export async function routingStatus(): Promise<{ walkingNetworkConfigured: boolean; router: RouterKind;
  riskAreasSupported: boolean; detail?: string }> {
  const router = activeRouter();
  if (router === 'internal') return { walkingNetworkConfigured: true, router, riskAreasSupported: true };
  if (router === 'none') return { walkingNetworkConfigured: false, router, riskAreasSupported: false,
    detail: walkRouterError || 'Nenhum roteador de caminhada disponível.' };
  try {
    const response = await fetch(`${osrmBaseUrl()}/nearest/v1/foot/-51.2177,-30.0346?number=1`, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return { walkingNetworkConfigured: false, router, riskAreasSupported: false, detail: `OSRM respondeu HTTP ${response.status}.` };
    const data = await response.json() as { code?: string; waypoints?: { distance: number }[] };
    return { walkingNetworkConfigured: data.code === 'Ok' && (data.waypoints?.[0]?.distance ?? Infinity) < 1000,
      router, riskAreasSupported: false };
  } catch (error) {
    return { walkingNetworkConfigured: false, router, riskAreasSupported: false,
      detail: `OSRM indisponível: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function routerOptions(scenario: Scenario): RouterOptions {
  return { riskAreas: (scenario.riskAreas ?? []).map(area => ({ id: area.id, name: area.name, vertices: area.vertices })) };
}

function requireRouterFor(scenario: Scenario): RouterKind {
  const router = activeRouter();
  if (router === 'none') throw new Error(walkRouterError || 'Nenhum roteador de caminhada disponível. Execute "npm run prepare-map".');
  if (router === 'osrm' && scenario.riskAreas?.length) {
    throw new Error('Áreas de risco exigem o roteador interno. Prepare o mapa com "npm run prepare-map" e reinicie sem ROUTER=osrm.');
  }
  return router;
}

/** Matriz de caminhada do posto e dos pacientes elegíveis (ordem esperada pelo núcleo). */
export async function buildScenarioCostMatrix(scenario: Scenario): Promise<CostMatrix> {
  const eligible = validateScenario(scenario).eligiblePatients;
  const nodeIds = [scenario.healthCenter.id, ...eligible.map(patient => patient.id)];
  if (requireRouterFor(scenario) === 'osrm') return buildWalkingCostMatrix({ ...scenario, patients: eligible });
  const points = [scenario.healthCenter.location, ...eligible.map(patient => patient.location)];
  const names = [`o posto ${scenario.healthCenter.name}`, ...eligible.map(patient => `o paciente ${patient.code}`)];
  try {
    const { distanceKm, durationMinutes } = walkRouter!.matrix(points, routerOptions(scenario));
    return { nodeIds, distanceMatrix: distanceKm, timeMatrix: durationMinutes };
  } catch (error) {
    // O roteador identifica pontos pelo índice; a interface precisa do código do paciente para corrigi-lo.
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(message
      .replace(/pontos (\d+) e (\d+)/gi, (_, a: string, b: string) => `${names[Number(a)] ?? a} e ${names[Number(b)] ?? b}`)
      .replace(/Ponto (\d+)/g, (_, a: string) => `${capitalize(names[Number(a)] ?? a)}`));
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Traçado pelas ruas passando pelos pontos na ordem, para o mapa e o GPX. */
export async function buildRoadRoute(scenario: Scenario, locations: Coordinates[]): Promise<RoadRoute> {
  if (requireRouterFor(scenario) === 'internal') {
    const road = walkRouter!.route(locations, routerOptions(scenario));
    const crossed = crossedRiskAreas(scenario, road.positions);
    return crossed.length ? { ...road, riskAreasCrossed: crossed } : road;
  }
  if (locations.length > 102) throw new Error('Rota excede 100 visitas para consulta viária.');
  const coordinates = locations.map(point => `${point.lng},${point.lat}`).join(';');
  const response = await fetch(`${osrmBaseUrl()}/route/v1/foot/${coordinates}?overview=full&geometries=geojson`,
    { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`OSRM respondeu HTTP ${response.status}.`);
  const data = await response.json() as { code: string; routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[] };
  const result = data.routes?.[0];
  if (data.code !== 'Ok' || !result) throw new Error(`OSRM não encontrou trajeto: ${data.code}.`);
  return { distanceKm: result.distance / 1000, durationMinutes: result.duration / 60,
    positions: result.geometry.coordinates.map(([lng, lat]) => [lat, lng]) };
}
