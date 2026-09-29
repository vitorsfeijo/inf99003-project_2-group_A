import { Coordinates, TerritoryPolygon } from '../types/index.js';

/**
 * Verifica se um ponto [lat, lng] está sobre o segmento formado por p1 e p2 (borda do polígono)
 */
function isPointOnSegment(point: Coordinates, p1: Coordinates, p2: Coordinates, epsilon = 1e-7): boolean {
  const crossProduct = (point.lat - p1.lat) * (p2.lng - p1.lng) - (point.lng - p1.lng) * (p2.lat - p1.lat);
  if (Math.abs(crossProduct) > epsilon) {
    return false;
  }

  const dotProduct = (point.lat - p1.lat) * (p2.lat - p1.lat) + (point.lng - p1.lng) * (p2.lng - p1.lng);
  if (dotProduct < 0) {
    return false;
  }

  const squaredLength = (p2.lat - p1.lat) ** 2 + (p2.lng - p1.lng) ** 2;
  if (dotProduct > squaredLength) {
    return false;
  }

  return true;
}

/**
 * Verifica se um ponto de coordenada (lat, lng) está contido ou na borda de um polígono de território.
 * Usa o algoritmo Ray-Casting com verificação explícita de limite/borda.
 */
export function isPointInPolygon(point: Coordinates, polygon: TerritoryPolygon): boolean {
  const vertices = polygon.vertices;
  if (!vertices || vertices.length < 3) {
    return false;
  }

  // 1. Verificação de borda (pontos exatamente sobre o perímetro)
  for (let i = 0; i < vertices.length; i++) {
    const p1 = vertices[i];
    const p2 = vertices[(i + 1) % vertices.length];
    if (isPointOnSegment(point, p1, p2)) {
      return true;
    }
  }

  // 2. Algoritmo Ray-Casting para o interior do polígono
  let inside = false;
  const x = point.lng;
  const y = point.lat;

  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].lng;
    const yi = vertices[i].lat;
    const xj = vertices[j].lng;
    const yj = vertices[j].lat;

    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Verifica se um ponto pertence a PELO MENOS UM dos polígonos de atuação do cenário.
 */
export function isPointInAnyPolygon(point: Coordinates, polygons: TerritoryPolygon[]): boolean {
  if (!polygons || polygons.length === 0) {
    return false;
  }
  return polygons.some(poly => isPointInPolygon(point, poly));
}
