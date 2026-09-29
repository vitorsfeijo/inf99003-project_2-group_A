import { Coordinates, HealthCenter, Patient, CostMatrix, CostParameters } from '../types/index.js';

const EARTH_RADIUS_KM = 6371.0088;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Calcula a distância Haversine em quilômetros entre duas coordenadas
 */
export function calculateHaversineDistanceKm(p1: Coordinates, p2: Coordinates): number {
  const dLat = toRadians(p2.lat - p1.lat);
  const dLng = toRadians(p2.lng - p1.lng);

  const lat1Rad = toRadians(p1.lat);
  const lat2Rad = toRadians(p2.lat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

/**
 * Converte distância em KM para tempo de deslocamento em minutos com base na velocidade média configurada
 */
export function calculateTravelTimeMinutes(distanceKm: number, speedKmh: number): number {
  if (speedKmh <= 0) return 0;
  return (distanceKm / speedKmh) * 60;
}

/**
 * Constrói a Matriz de Custos (Distância e Tempo) entre todos os vértices elegíveis.
 * O índice 0 da matriz é SEMPRE o Posto de Saúde.
 */
export function buildCostMatrix(
  healthCenter: HealthCenter,
  eligiblePatients: Patient[],
  params: CostParameters
): CostMatrix {
  // Lista de nós: [0] -> Posto de Saúde, [1..N] -> Pacientes
  const nodes: { id: string; location: Coordinates }[] = [
    { id: healthCenter.id, location: healthCenter.location },
    ...eligiblePatients.map(p => ({ id: p.id, location: p.location }))
  ];

  const nodeCount = nodes.length;
  const distanceMatrix: number[][] = Array.from({ length: nodeCount }, () => Array(nodeCount).fill(0));
  const timeMatrix: number[][] = Array.from({ length: nodeCount }, () => Array(nodeCount).fill(0));

  for (let i = 0; i < nodeCount; i++) {
    for (let j = 0; j < nodeCount; j++) {
      if (i === j) {
        distanceMatrix[i][j] = 0;
        timeMatrix[i][j] = 0;
      } else {
        const dist = calculateHaversineDistanceKm(nodes[i].location, nodes[j].location);
        const time = calculateTravelTimeMinutes(dist, params.travelSpeedKmh);
        distanceMatrix[i][j] = dist;
        timeMatrix[i][j] = time;
      }
    }
  }

  return {
    nodeIds: nodes.map(n => n.id),
    distanceMatrix,
    timeMatrix
  };
}
