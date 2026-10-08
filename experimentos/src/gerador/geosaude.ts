import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { Coordinates, TerritoryPolygon, countWorkingDaysInNextMonth } from '../../../artefato/packages/core/dist/index.js';
import { generateSyntheticScenario, mulberry32 } from './index.js';

type Ring = [number, number][];
type Geometry = { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] } | { type: 'Point'; coordinates: [number, number] };
type Feature = { type: 'Feature'; properties?: Record<string, unknown>; geometry: Geometry };

function insideRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function sampleInPolygon(rings: Ring[], random: () => number): Coordinates {
  const outer = rings[0];
  if (!outer || outer.length < 4) throw new Error('Polígono GeoJSON sem anel externo válido.');
  const lngs = outer.map(point => point[0]);
  const lats = outer.map(point => point[1]);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  for (let attempt = 0; attempt < 100000; attempt++) {
    const lng = minLng + random() * (maxLng - minLng);
    const lat = minLat + random() * (maxLat - minLat);
    if (insideRing(lng, lat, outer) && !rings.slice(1).some(hole => insideRing(lng, lat, hole))) return { lat, lng };
  }
  throw new Error('Não foi possível amostrar o território GeoJSON. Verifique a geometria.');
}

function loadGeoFeatures(geojsonPath: string): { allFeatures: Feature[]; sha256: string } {
  const bytes = fs.readFileSync(geojsonPath);
  let input: Feature | { type: 'FeatureCollection'; features: Feature[] };
  if (/\.(kml|kmz)$/i.test(geojsonPath)) {
    const converter = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../scripts/kml_to_geojson.py');
    const result = spawnSync('python3', [converter, geojsonPath], { encoding: 'utf8', maxBuffer: 100 * 1024 * 1024 });
    if (result.status !== 0) throw new Error(result.stderr.trim() || result.error?.message || 'Falha ao converter KML/KMZ.');
    input = JSON.parse(result.stdout);
  } else {
    input = JSON.parse(bytes.toString('utf8'));
  }
  const allFeatures = input.type === 'FeatureCollection' ? input.features : [input];
  return { allFeatures, sha256: createHash('sha256').update(bytes).digest('hex') };
}

function generateFromFeatures(geojsonPath: string, allFeatures: Feature[], sha256: string,
  patientCount: number, seed: number, territoryNameInput?: string, teamCount = 1) {
  if (!Number.isInteger(patientCount) || patientCount < 1) throw new Error('patientCount deve ser inteiro positivo.');
  if (!Number.isInteger(teamCount) || teamCount < 1) throw new Error('teamCount deve ser inteiro positivo.');
  const territoryName = territoryNameInput?.toLocaleLowerCase('pt-BR');
  const apsFeatures = allFeatures.filter(feature => feature.properties?.folder === 'Territórios da Atenção Primária');
  const territoryFeatures = apsFeatures.length ? apsFeatures : allFeatures.filter(feature => feature.geometry.type !== 'Point');
  const features = territoryName ? territoryFeatures.filter(feature =>
    String(feature.properties?.name ?? feature.properties?.nome ?? '').toLocaleLowerCase('pt-BR') === territoryName) : territoryFeatures;
  if (features.length === 0) throw new Error(`Nenhum território corresponde a ${territoryNameInput}.`);
  if (features.length > 1 && !territoryName) throw new Error('O arquivo possui várias áreas. Defina GEOSAUDE_TERRITORY_NAME para escolher o território da UBS.');
  const polygons = features.flatMap(feature => {
    if (feature.geometry.type === 'Polygon') return [{ rings: feature.geometry.coordinates, name: String(feature.properties?.name ?? feature.properties?.nome ?? 'Território APS') }];
    if (feature.geometry.type === 'MultiPolygon') return feature.geometry.coordinates.map((rings, index) => ({ rings, name: `${String(feature.properties?.name ?? feature.properties?.nome ?? 'Território APS')} ${index + 1}` }));
    throw new Error('O território deve conter Polygon ou MultiPolygon GeoJSON.');
  });
  if (polygons.length === 0) throw new Error('Nenhum polígono encontrado no GeoJSON.');
  for (const polygon of polygons) {
    if (polygon.rings[0]?.length < 4) throw new Error('Polígono GeoJSON inválido.');
  }
  const random = mulberry32(seed);
  const weights = polygons.map(({ rings }) => {
    const outer = rings[0];
    const width = Math.max(...outer.map(point => point[0])) - Math.min(...outer.map(point => point[0]));
    const height = Math.max(...outer.map(point => point[1])) - Math.min(...outer.map(point => point[1]));
    return width * height * Math.cos(outer[0][1] * Math.PI / 180);
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (!(totalWeight > 0)) throw new Error('GeoJSON sem área amostrável.');
  const territory: TerritoryPolygon[] = polygons.map(({ rings, name }, index) => ({
    id: `geosaude_${index + 1}`, name,
    vertices: rings[0].slice(0, -1).map(([lng, lat]) => ({ lat, lng })),
    holes: rings.slice(1).map(ring => ring.slice(0, -1).map(([lng, lat]) => ({ lat, lng })))
  }));
  const unitPoints = allFeatures.filter(feature => feature.geometry.type === 'Point' &&
    feature.properties?.folder === 'Unidades de Saúde');
  const matchingPoint = unitPoints.find(feature =>
    String(feature.properties?.name ?? '').toLocaleLowerCase('pt-BR') === territoryName);
  const outer = polygons[0].rings[0];
  const centroid = outer.reduce((sum, [lng, lat]) => ({ lng: sum.lng + lng / outer.length, lat: sum.lat + lat / outer.length }), { lng: 0, lat: 0 });
  const nearestPoint = matchingPoint ?? unitPoints.reduce<Feature | undefined>((best, feature) => {
    if (feature.geometry.type !== 'Point') return best;
    const distance = (point: Feature) => point.geometry.type === 'Point'
      ? Math.hypot((point.geometry.coordinates[0] - centroid.lng) * Math.cos(centroid.lat * Math.PI / 180), point.geometry.coordinates[1] - centroid.lat)
      : Infinity;
    return !best || distance(feature) < distance(best) ? feature : best;
  }, undefined);
  const selectedPoint = matchingPoint ?? nearestPoint;
  const healthCenterLat = process.env.GEOSAUDE_HC_LAT === undefined
    ? (selectedPoint?.geometry.type === 'Point' ? selectedPoint.geometry.coordinates[1] : NaN)
    : Number(process.env.GEOSAUDE_HC_LAT);
  const healthCenterLng = process.env.GEOSAUDE_HC_LNG === undefined
    ? (selectedPoint?.geometry.type === 'Point' ? selectedPoint.geometry.coordinates[0] : NaN)
    : Number(process.env.GEOSAUDE_HC_LNG);
  if (!Number.isFinite(healthCenterLat) || !Number.isFinite(healthCenterLng)) {
    throw new Error('Posto não encontrado no arquivo. Informe GEOSAUDE_HC_LAT e GEOSAUDE_HC_LNG da UBS.');
  }
  const slug = String(features[0].properties?.name ?? features[0].properties?.nome ?? 'territorio')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const scenario = generateSyntheticScenario({
    seed, scenarioId: `geosaude_${slug}_${seed}_${patientCount}`, patientCount,
    teamCount, planningHorizonDays: countWorkingDaysInNextMonth('2026-10-01'),
    maxAnticipationDays: 2, centerLat: healthCenterLat, centerLng: healthCenterLng,
    radiusKm: 1, overdueFraction: 0.5
  });
  scenario.healthCenter.name = String(selectedPoint?.properties?.name ?? 'UBS de referência (GeoSaúde)');
  scenario.polygons = territory;
  scenario.patients = scenario.patients.map(patient => {
    let draw = random() * totalWeight;
    let selected = polygons.length - 1;
    for (let i = 0; i < weights.length; i++) {
      draw -= weights[i];
      if (draw <= 0) { selected = i; break; }
    }
    return { ...patient, location: sampleInPolygon(polygons[selected].rings, random) };
  });
  return { scenario, provenance: {
    source: path.basename(geojsonPath), sha256,
    territoryName: String(features[0].properties?.name ?? features[0].properties?.nome ?? 'Território APS'),
    healthCenter: scenario.healthCenter, teamCount: scenario.teams.length,
    healthCenterMatch: process.env.GEOSAUDE_HC_LAT !== undefined ? 'coordenadas explícitas' : matchingPoint ? 'nome exato' : 'unidade mais próxima do centro geométrico; revisar associação',
    startDate: scenario.startDate, seed, patientCount,
    method: 'Amostragem uniforme sintética dentro dos polígonos; demanda clínica simulada. Não são moradores reais nem prevalências observadas.'
  } };
}

export function generateGeosaudeScenario(source: string, patientCount = 30, seed = 20261008) {
  const { allFeatures, sha256 } = loadGeoFeatures(source);
  const teamCount = Number(process.env.GEOSAUDE_TEAMS || 1);
  return generateFromFeatures(source, allFeatures, sha256, patientCount, seed,
    process.env.GEOSAUDE_TERRITORY_NAME, teamCount);
}

export function generateAllGeosaudeScenarios(source: string, patientsPerTerritory = 30, seed = 20261008) {
  const { allFeatures, sha256 } = loadGeoFeatures(source);
  const territories = allFeatures.filter(feature => feature.properties?.folder === 'Territórios da Atenção Primária'
    && feature.geometry.type !== 'Point');
  if (!territories.length) throw new Error('Nenhum território da Atenção Primária encontrado no arquivo.');
  const names = [...new Set(territories.map(feature => String(feature.properties?.name)))];
  return names.map((name, index) => generateFromFeatures(source, allFeatures, sha256,
    patientsPerTerritory, seed + index, name, 1));
}

function saveGenerated(output: ReturnType<typeof generateGeosaudeScenario>) {
  const directory = path.resolve(process.cwd(), 'cenarios');
  const provenanceDirectory = path.resolve(process.cwd(), 'provenance');
  fs.mkdirSync(directory, { recursive: true });
  fs.mkdirSync(provenanceDirectory, { recursive: true });
  fs.writeFileSync(path.join(directory, `${output.scenario.id}.json`), JSON.stringify(output.scenario, null, 2));
  fs.writeFileSync(path.join(provenanceDirectory, `${output.scenario.id}.json`), JSON.stringify(output.provenance, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const source = process.argv[2];
  if (!source) throw new Error('Uso: npm run generate:geosaude -- territorio.kmz --all [pacientesPorTerritorio] [semente]');
  if (process.argv[3] === '--all') {
    const outputs = generateAllGeosaudeScenarios(source, Number(process.argv[4] || 30), Number(process.argv[5] || 20261008));
    for (const output of outputs) saveGenerated(output);
    console.log(`Gerados ${outputs.length} territórios, ${outputs.reduce((sum, output) => sum + output.scenario.patients.length, 0)} moradores sintéticos e uma equipe por território.`);
    console.log(`Associações aproximadas de unidade: ${outputs.filter(output => output.provenance.healthCenterMatch.includes('mais próxima')).map(output => output.provenance.territoryName).join(', ') || 'nenhuma'}`);
  } else {
    const output = generateGeosaudeScenario(source, Number(process.argv[3] || 30), Number(process.argv[4] || 20261008));
    saveGenerated(output);
    console.log(`Gerado ${output.scenario.id}: ${output.scenario.patients.length} pacientes sintéticos; origem ${output.provenance.sha256}`);
  }
}
