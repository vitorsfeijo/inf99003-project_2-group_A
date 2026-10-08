import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  planScenario, sampleTerritoryPatients, verifyPlan,
  type Scenario, type Coordinates, type TerritoryPolygon
} from '../../../artefato/packages/core/dist/index.js';
import { runDynamicSimulation } from '../simulador/simulador-dinamico.js';
import { mulberry32 } from '../gerador/index.js';

/** Grade fatorial completa: os cinco fatores variam independentemente. */
export const DESIGN = {
  sourceScenario: 'geosaude_us_restinga_20261106_30',
  seeds: [20261008, 20261009, 20261010],
  patients: [15, 30, 45],
  areaMultipliers: [0.5, 1, 2],
  planningDays: [5, 10, 22],
  overdueFractions: [0, 0.25, 0.5],
  missRates: [0, 0.05, 0.1],
  strategies: ['main-heuristic', 'nearest-baseline', 'urgency-baseline'],
  startDate: '2026-10-01',
  dailyWorkMinutes: 240,
  walkingSpeedKmh: 4.5,
  maxAnticipationDays: 2
} as const;

function datePlusDays(date: string, days: number): string {
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function scalePoint(point: Coordinates, origin: Coordinates, factor: number): Coordinates {
  return { lat: origin.lat + (point.lat - origin.lat) * factor,
    lng: origin.lng + (point.lng - origin.lng) * factor };
}

function scalePolygon(polygon: TerritoryPolygon, origin: Coordinates, factor: number): TerritoryPolygon {
  return {
    ...polygon,
    vertices: polygon.vertices.map(point => scalePoint(point, origin, factor)),
    holes: polygon.holes?.map(hole => hole.map(point => scalePoint(point, origin, factor)))
  };
}

function ringAreaKm2(vertices: Coordinates[], referenceLat: number): number {
  const latKm = 111.195;
  const lngKm = latKm * Math.cos(referenceLat * Math.PI / 180);
  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i], b = vertices[(i + 1) % vertices.length];
    area += (a.lng * lngKm) * (b.lat * latKm) - (b.lng * lngKm) * (a.lat * latKm);
  }
  return Math.abs(area) / 2;
}

function territoryAreaKm2(polygons: TerritoryPolygon[], referenceLat: number): number {
  return polygons.reduce((sum, polygon) => sum + ringAreaKm2(polygon.vertices, referenceLat)
    - (polygon.holes ?? []).reduce((holes, hole) => holes + ringAreaKm2(hole, referenceLat), 0), 0);
}

export function createScenario(base: Scenario, seed: number, patientCount: number, areaMultiplier: number,
  planningDays: number, overdueFraction: number): { scenario: Scenario; realizedOverdueFraction: number } {
  // Amostra única por semente. Subconjuntos de 15/30/45 preservam os mesmos pacientes.
  const sampled = sampleTerritoryPatients(base, Math.max(...DESIGN.patients), seed);
  const random = mulberry32(seed ^ 0x5a17cafe);
  const patientDraws = sampled.patients.map(() => ({
    overdue: random(), overdueDays: 1 + Math.floor(random() * 10),
    dueOffsetDays: Math.floor(random() * 5)
  }));
  const scale = Math.sqrt(areaMultiplier);
  const origin = base.healthCenter.location;
  const patients = sampled.patients.slice(0, patientCount).map((patient, index) => {
    const draw = patientDraws[index];
    const dueDate = draw.overdue < overdueFraction
      ? datePlusDays(DESIGN.startDate, -draw.overdueDays)
      : datePlusDays(DESIGN.startDate, draw.dueOffsetDays);
    return {
      ...patient,
      location: scalePoint(patient.location, origin, scale),
      conditions: patient.conditions.map(condition => ({
        ...condition, lastVisitDate: undefined, initialDueDate: dueDate,
        maxIntervalDays: 60
      }))
    };
  });
  const scenario: Scenario = {
    ...sampled,
    id: `fatorial_restinga_s${seed}_p${patientCount}_a${areaMultiplier}_h${planningDays}_v${overdueFraction}`,
    startDate: DESIGN.startDate,
    planningHorizonDays: planningDays,
    maxAnticipationDays: DESIGN.maxAnticipationDays,
    costParameters: { travelSpeedKmh: DESIGN.walkingSpeedKmh },
    teams: base.teams.map(team => ({ ...team, dailyWorkMinutes: DESIGN.dailyWorkMinutes, availableDays: [] })),
    polygons: base.polygons.map(polygon => scalePolygon(polygon, origin, scale)),
    patients
  };
  return { scenario, realizedOverdueFraction: patients.filter(patient =>
    (patient.conditions[0].initialDueDate ?? DESIGN.startDate) < DESIGN.startDate).length / patients.length };
}

function csv(rows: Record<string, string | number>[]): string {
  if (rows.length === 0) throw new Error('Não há resultados para exportar.');
  const fields = Object.keys(rows[0]);
  const cell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  return [fields.join(','), ...rows.map(row => fields.map(field => cell(row[field])).join(','))].join('\n') + '\n';
}

function main(): void {
  const experimentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const base: Scenario = JSON.parse(fs.readFileSync(path.join(experimentRoot,
    'cenarios', `${DESIGN.sourceScenario}.json`), 'utf8'));
  const outputDir = path.join(experimentRoot, 'resultados', 'fatorial');
  fs.mkdirSync(outputDir, { recursive: true });
  const baseArea = territoryAreaKm2(base.polygons, base.healthCenter.location.lat);
  if (!(baseArea > 0)) throw new Error('A área do território base deve ser positiva.');
  const staticRows: Record<string, string | number>[] = [];
  const dynamicRows: Record<string, string | number>[] = [];
  const totalInstances = DESIGN.seeds.length * DESIGN.patients.length * DESIGN.areaMultipliers.length
    * DESIGN.planningDays.length * DESIGN.overdueFractions.length;
  let completed = 0;
  for (const seed of DESIGN.seeds) for (const patientCount of DESIGN.patients)
    for (const areaMultiplier of DESIGN.areaMultipliers)
      for (const planningDays of DESIGN.planningDays)
        for (const overdueFraction of DESIGN.overdueFractions) {
          const { scenario, realizedOverdueFraction } = createScenario(base, seed, patientCount,
            areaMultiplier, planningDays, overdueFraction);
          const areaKm2 = baseArea * areaMultiplier;
          const factors = {
            scenarioId: scenario.id, seed, patientCount, areaMultiplier,
            areaKm2: Number(areaKm2.toFixed(4)),
            densityPatientsKm2: Number((patientCount / areaKm2).toFixed(3)),
            planningDays, overdueFraction, realizedOverdueFraction
          };
          for (const strategyId of DESIGN.strategies) {
            const started = performance.now();
            const plan = planScenario(scenario, { strategyId, enable1_5Opt: true });
            const planningTimeMs = performance.now() - started;
            const verification = verifyPlan(scenario, plan);
            if (!verification.isValid) throw new Error(`${scenario.id}/${strategyId}: ${verification.errors.join('; ')}`);
            const { delayBuckets, ...metrics } = plan.metrics;
            staticRows.push({ ...factors, strategyId,
              planningTimeMs: Number(planningTimeMs.toFixed(3)),
              allocatedVisits: plan.routes.reduce((sum, route) => sum + route.visits.length, 0),
              unallocatedVisits: plan.unallocatedVisits.length,
              ...metrics,
              delayOnTime: delayBuckets.onTime,
              delayOneToTwoDays: delayBuckets.oneToTwoDays,
              delayThreeToSevenDays: delayBuckets.threeToSevenDays,
              delayOverSevenDays: delayBuckets.overSevenDays,
              delayUnallocated: delayBuckets.unallocated });
            for (const missRate of DESIGN.missRates) {
              const record = runDynamicSimulation(scenario, strategyId, missRate, planningDays,
                `restinga|${seed}`);
              dynamicRows.push({ ...record, ...factors });
            }
          }
          completed++;
          if (completed % 27 === 0 || completed === totalInstances) {
            console.log(`Fatorial: ${completed}/${totalInstances} instâncias concluídas`);
          }
        }
  const manifest = { design: DESIGN, sourceScenario: DESIGN.sourceScenario,
    sourceAreaKm2: Number(baseArea.toFixed(4)), instanceCount: completed,
    staticRecordCount: staticRows.length, dynamicRecordCount: dynamicRows.length,
    costModel: 'Haversine entre endereços sintéticos, 4,5 km/h; não é roteamento viário OSRM',
    areaModel: 'Polígono GeoSaúde Restinga escalado ao redor da UBS; área aproximada por projeção local',
    dateModel: 'Vencimentos futuros entre 0 e 4 dias corridos; vencidos entre 1 e 10 dias antes do início',
    output: ['static.json', 'static.csv', 'dynamic.json', 'dynamic.csv'] };
  fs.writeFileSync(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  for (const [name, rows] of [['static', staticRows], ['dynamic', dynamicRows]] as const) {
    fs.writeFileSync(path.join(outputDir, `${name}.json`), JSON.stringify(rows, null, 2));
    fs.writeFileSync(path.join(outputDir, `${name}.csv`), csv(rows));
  }
  console.log(`Resultados fatoriais em ${outputDir}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
