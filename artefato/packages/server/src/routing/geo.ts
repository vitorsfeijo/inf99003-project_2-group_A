/**
 * Utilitários geométricos usados pelo roteador a pé.
 *
 * As distâncias seguem a mesma fórmula de haversine e o mesmo raio terrestre
 * usados pelo OSRM (`EARTH_RADIUS = 6372797.560856 m`), para que as métricas
 * fiquem comparáveis às do perfil `foot.lua`.
 */

/** Raio terrestre em metros usado pelo OSRM. */
export const EARTH_RADIUS_METERS = 6372797.560856;

const DEG_TO_RAD = Math.PI / 180;

/** Distância de grande círculo (haversine) em metros entre dois pontos em graus. */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const phi1 = lat1 * DEG_TO_RAD;
  const phi2 = lat2 * DEG_TO_RAD;
  const dPhi = phi2 - phi1;
  const dLambda = (lng2 - lng1) * DEG_TO_RAD;
  const sinPhi = Math.sin(dPhi / 2);
  const sinLambda = Math.sin(dLambda / 2);
  const a = sinPhi * sinPhi + Math.cos(phi1) * Math.cos(phi2) * sinLambda * sinLambda;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Metros por grau de latitude (aproximação esférica coerente com o raio acima). */
export const METERS_PER_DEGREE_LAT = EARTH_RADIUS_METERS * DEG_TO_RAD;

/** Metros por grau de longitude na latitude informada. */
export function metersPerDegreeLng(lat: number): number {
  return METERS_PER_DEGREE_LAT * Math.cos(lat * DEG_TO_RAD);
}

/**
 * Polígono preparado para testes repetidos: vértices em arrays tipados e caixa
 * envolvente para pré-filtro. Coordenadas tratadas no plano (lat, lng), o que é
 * adequado para polígonos de escala urbana.
 */
export interface PreparedPolygon {
  lat: Float64Array;
  lng: Float64Array;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export function preparePolygon(vertices: { lat: number; lng: number }[], label: string): PreparedPolygon {
  if (!Array.isArray(vertices) || vertices.length < 3) {
    throw new Error(`Área de risco ${label} inválida: são necessários ao menos 3 vértices.`);
  }
  // Remove o vértice de fechamento repetido, se houver.
  let count = vertices.length;
  const first = vertices[0];
  const last = vertices[count - 1];
  if (count > 3 && first.lat === last.lat && first.lng === last.lng) count--;
  const lat = new Float64Array(count);
  const lng = new Float64Array(count);
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (let i = 0; i < count; i++) {
    const vertex = vertices[i];
    if (!vertex || !Number.isFinite(vertex.lat) || !Number.isFinite(vertex.lng)) {
      throw new Error(`Área de risco ${label} inválida: vértice ${i} sem latitude/longitude numéricas.`);
    }
    lat[i] = vertex.lat;
    lng[i] = vertex.lng;
    if (vertex.lat < minLat) minLat = vertex.lat;
    if (vertex.lat > maxLat) maxLat = vertex.lat;
    if (vertex.lng < minLng) minLng = vertex.lng;
    if (vertex.lng > maxLng) maxLng = vertex.lng;
  }
  return { lat, lng, minLat, maxLat, minLng, maxLng };
}

/** Ponto em polígono por lançamento de raio (regra par-ímpar); aceita polígonos não convexos. */
export function pointInPolygon(polygon: PreparedPolygon, lat: number, lng: number): boolean {
  if (lat < polygon.minLat || lat > polygon.maxLat || lng < polygon.minLng || lng > polygon.maxLng) return false;
  const pLat = polygon.lat;
  const pLng = polygon.lng;
  const count = pLat.length;
  let inside = false;
  for (let i = 0, j = count - 1; i < count; j = i++) {
    const latI = pLat[i], latJ = pLat[j];
    if ((latI > lat) !== (latJ > lat)) {
      const crossLng = pLng[i] + ((lat - latI) / (latJ - latI)) * (pLng[j] - pLng[i]);
      if (lng < crossLng) inside = !inside;
    }
  }
  return inside;
}

function orientation(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  const value = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  return value > 0 ? 1 : value < 0 ? -1 : 0;
}

function onSegment(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): boolean {
  return Math.min(ax, bx) <= cx && cx <= Math.max(ax, bx) && Math.min(ay, by) <= cy && cy <= Math.max(ay, by);
}

/** Interseção (inclusive toque) entre os segmentos AB e CD no plano. */
export function segmentsIntersect(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): boolean {
  const o1 = orientation(ax, ay, bx, by, cx, cy);
  const o2 = orientation(ax, ay, bx, by, dx, dy);
  const o3 = orientation(cx, cy, dx, dy, ax, ay);
  const o4 = orientation(cx, cy, dx, dy, bx, by);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(ax, ay, bx, by, cx, cy)) return true;
  if (o2 === 0 && onSegment(ax, ay, bx, by, dx, dy)) return true;
  if (o3 === 0 && onSegment(cx, cy, dx, dy, ax, ay)) return true;
  if (o4 === 0 && onSegment(cx, cy, dx, dy, bx, by)) return true;
  return false;
}

/**
 * Verdadeiro se o segmento (lat1,lng1)-(lat2,lng2) tem algum ponto dentro do
 * polígono: uma extremidade (ou o ponto médio) interna, ou cruzamento com
 * alguma aresta do polígono. Inclui o pré-filtro por caixa envolvente.
 */
export function segmentTouchesPolygon(
  polygon: PreparedPolygon, lat1: number, lng1: number, lat2: number, lng2: number,
): boolean {
  if (Math.max(lat1, lat2) < polygon.minLat || Math.min(lat1, lat2) > polygon.maxLat ||
      Math.max(lng1, lng2) < polygon.minLng || Math.min(lng1, lng2) > polygon.maxLng) {
    return false;
  }
  if (pointInPolygon(polygon, (lat1 + lat2) / 2, (lng1 + lng2) / 2)) return true;
  if (pointInPolygon(polygon, lat1, lng1) || pointInPolygon(polygon, lat2, lng2)) return true;
  const pLat = polygon.lat;
  const pLng = polygon.lng;
  const count = pLat.length;
  for (let i = 0, j = count - 1; i < count; j = i++) {
    if (segmentsIntersect(lng1, lat1, lng2, lat2, pLng[j], pLat[j], pLng[i], pLat[i])) return true;
  }
  return false;
}
