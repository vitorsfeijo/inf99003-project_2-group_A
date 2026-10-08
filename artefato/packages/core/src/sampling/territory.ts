import { Coordinates, Patient, Scenario, TerritoryPolygon } from '../types/index.js';
import { isPointInPolygon } from '../validation/polygon.js';

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    let value = state += 0x6D2B79F5;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function polygonBounds(polygon: TerritoryPolygon) {
  const lats = polygon.vertices.map(vertex => vertex.lat);
  const lngs = polygon.vertices.map(vertex => vertex.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const weight = (maxLat - minLat) * (maxLng - minLng) * Math.cos(minLat * Math.PI / 180);
  return { polygon, minLat, maxLat, minLng, maxLng, weight };
}

/** Amostra endereços sintéticos nos contornos de um cenário GeoSaúde, com semente reproduzível. */
export function sampleTerritoryPatients(base: Scenario, count: number, seed: number): Scenario {
  if (!base.id.startsWith('geosaude_') || base.polygons.length === 0 || base.patients.length === 0) {
    throw new Error('Selecione um cenário base GeoSaúde com polígonos e perfis clínicos.');
  }
  if (!Number.isInteger(count) || count < 1 || count > 1000) {
    throw new Error('A quantidade de pacientes deve ser um inteiro entre 1 e 1000.');
  }
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 4294967295) {
    throw new Error('A semente deve ser um inteiro entre 0 e 4294967295.');
  }
  const bounds = base.polygons.map(polygonBounds);
  const totalWeight = bounds.reduce((sum, item) => sum + item.weight, 0);
  if (!(totalWeight > 0)) throw new Error('Os polígonos selecionados não possuem área amostrável.');
  const random = mulberry32(seed);
  const patients: Patient[] = [];
  for (let index = 0; index < count; index++) {
    let draw = random() * totalWeight;
    let selected = bounds[bounds.length - 1];
    for (const item of bounds) {
      draw -= item.weight;
      if (draw <= 0) { selected = item; break; }
    }
    let location: Coordinates | undefined;
    for (let attempt = 0; attempt < 100000; attempt++) {
      const candidate = {
        lat: selected.minLat + random() * (selected.maxLat - selected.minLat),
        lng: selected.minLng + random() * (selected.maxLng - selected.minLng)
      };
      if (isPointInPolygon(candidate, selected.polygon)) { location = candidate; break; }
    }
    if (!location) throw new Error(`Não foi possível amostrar o polígono ${selected.polygon.name}.`);
    const template = base.patients[Math.floor(random() * base.patients.length)];
    patients.push({
      ...template,
      id: `pat_${index + 1}`,
      code: `P${String(index + 1).padStart(4, '0')}`,
      location,
      conditions: template.conditions.map(condition => ({ ...condition }))
    });
  }
  return {
    ...base,
    id: `${base.id}_amostra_${seed}_${count}_h${base.planningHorizonDays}`,
    version: 1,
    patients,
    polygons: base.polygons.map(polygon => ({ ...polygon, vertices: polygon.vertices.map(vertex => ({ ...vertex })),
      holes: polygon.holes?.map(hole => hole.map(vertex => ({ ...vertex }))) })),
    teams: base.teams.map(team => ({ ...team, availableDays: [...team.availableDays] }))
  };
}
