import { Scenario, Patient, Team, TerritoryPolygon, HealthCenter } from '../../../artefato/packages/core/dist/index.js';
import fs from 'fs';
import path from 'path';

/**
 * Gerador de Números Pseudo-Aleatórios (Mulberry32) com Semente
 */
function mulberry32(seed: number) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GeneratorConfig {
  seed: number;
  scenarioId: string;
  patientCount: number;
  teamCount: number;
  planningHorizonDays: number;
  maxAnticipationDays: number;
  centerLat: number;
  centerLng: number;
  radiusKm: number;
  overdueFraction: number;
  dailyWorkMinutes?: number;
  distribution?: 'uniform' | 'clustered';
  placeBoundaryPatient?: boolean;
}

export function generateSyntheticScenario(config: GeneratorConfig): Scenario {
  const random = mulberry32(config.seed);

  const healthCenter: HealthCenter = {
    id: `hc_${config.scenarioId}`,
    name: `Posto de Saúde ${config.scenarioId}`,
    location: { lat: config.centerLat, lng: config.centerLng }
  };

  // Raio do polígono
  const deltaLat = (config.radiusKm * 1.2) / 111;
  const deltaLng = (config.radiusKm * 1.2) / (111 * Math.cos((config.centerLat * Math.PI) / 180));

  const polygon: TerritoryPolygon = {
    id: `poly_${config.scenarioId}`,
    name: 'Região de Atuação Sintética',
    vertices: [
      { lat: config.centerLat - deltaLat, lng: config.centerLng - deltaLng },
      { lat: config.centerLat - deltaLat, lng: config.centerLng + deltaLng },
      { lat: config.centerLat + deltaLat, lng: config.centerLng + deltaLng },
      { lat: config.centerLat + deltaLat, lng: config.centerLng - deltaLng }
    ]
  };

  // Gerar Equipes
  const teams: Team[] = [];
  const workMinutes = config.dailyWorkMinutes || 240; // 4 horas padrão

  for (let i = 1; i <= config.teamCount; i++) {
    teams.push({
      id: `team_${i}`,
      name: `Equipe ${String.fromCharCode(64 + i)}`,
      doctorName: `Dr(a). Medico ${i}`,
      nurseName: `Enf. Enfermeiro ${i}`,
      socialWorkerName: `AS Assistente ${i}`,
      dailyWorkMinutes: workMinutes,
      availableDays: []
    });
  }

  const patients: Patient[] = [];
  const baseDateStr = '2026-10-01';

  // Centros de clusters geográficos (para distribuição em bairros/agrupamentos)
  const clusterCenters = [
    { lat: config.centerLat + deltaLat * 0.5, lng: config.centerLng + deltaLng * 0.5 },
    { lat: config.centerLat - deltaLat * 0.5, lng: config.centerLng - deltaLng * 0.5 },
    { lat: config.centerLat + deltaLat * 0.4, lng: config.centerLng - deltaLng * 0.4 }
  ];

  for (let i = 1; i <= config.patientCount; i++) {
    let pLat: number;
    let pLng: number;

    if (config.placeBoundaryPatient && i === 1) {
      // Paciente posicionado exatamente sobre a linha da borda do polígono
      pLat = config.centerLat - deltaLat;
      pLng = config.centerLng;
    } else if (config.distribution === 'clustered') {
      // Distribuição por Agrupamentos (Clusters)
      const cluster = clusterCenters[i % clusterCenters.length];
      const r = (random() * 0.3 * config.radiusKm) / 111;
      const angle = random() * 2 * Math.PI;
      pLat = cluster.lat + r * Math.sin(angle);
      pLng = cluster.lng + r * Math.cos(angle);
    } else {
      // Distribuição Uniforme em círculo em volta da unidade
      const angle = random() * 2 * Math.PI;
      const r = Math.sqrt(random()) * (config.radiusKm / 111);
      pLat = config.centerLat + r * Math.sin(angle);
      pLng = config.centerLng + r * Math.cos(angle);
    }

    const isOverdue = random() < config.overdueFraction;
    let lastVisitDate: string | undefined;
    let initialDueDate: string | undefined;

    if (isOverdue) {
      const overdueDays = Math.floor(random() * 10) + 1;
      initialDueDate = `2026-09-${String(Math.max(1, 30 - overdueDays)).padStart(2, '0')}`;
    } else {
      const futureDays = Math.floor(random() * 5);
      initialDueDate = `2026-10-${String(1 + futureDays).padStart(2, '0')}`;
    }

    patients.push({
      id: `pat_${i}`,
      code: `P${String(i).padStart(3, '0')}`,
      location: { lat: pLat, lng: pLng },
      defaultVisitDurationMinutes: 30,
      conditions: [
        {
          conditionId: 'cond_principal',
          lastVisitDate,
          initialDueDate,
          maxIntervalDays: 14,
          priorityWeight: Math.floor(random() * 5) + 1
        }
      ]
    });
  }

  return {
    id: config.scenarioId,
    version: 1,
    healthCenter,
    polygons: [polygon],
    patients,
    teams,
    startDate: baseDateStr,
    planningHorizonDays: config.planningHorizonDays,
    maxAnticipationDays: config.maxAnticipationDays,
    costParameters: {
      travelSpeedKmh: 20
    }
  };
}

const targetDir = path.resolve(process.cwd(), 'cenarios');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Suíte Completa de Cenários de Pesquisa
const scenariosConfig: GeneratorConfig[] = [
  // --- Grupo 1: Cenários Base de Capacidade ---
  {
    seed: 42,
    scenarioId: 'cenario_folgado',
    patientCount: 6,
    teamCount: 2,
    planningHorizonDays: 3,
    maxAnticipationDays: 2,
    centerLat: -30.0346,
    centerLng: -51.2177,
    radiusKm: 2.0,
    overdueFraction: 0.3
  },
  {
    seed: 123,
    scenarioId: 'cenario_equilibrado',
    patientCount: 15,
    teamCount: 2,
    planningHorizonDays: 3,
    maxAnticipationDays: 2,
    centerLat: -30.0346,
    centerLng: -51.2177,
    radiusKm: 3.5,
    overdueFraction: 0.5
  },
  {
    seed: 999,
    scenarioId: 'cenario_escasso',
    patientCount: 30,
    teamCount: 2,
    planningHorizonDays: 3,
    maxAnticipationDays: 2,
    centerLat: -30.0346,
    centerLng: -51.2177,
    radiusKm: 5.0,
    overdueFraction: 0.7
  },

  // --- Grupo 2: Variação de Escala e Equipes ---
  {
    seed: 101,
    scenarioId: 'cenario_pequeno_1eq',
    patientCount: 10,
    teamCount: 1,
    planningHorizonDays: 3,
    maxAnticipationDays: 2,
    centerLat: -30.0346,
    centerLng: -51.2177,
    radiusKm: 2.5,
    overdueFraction: 0.4
  },
  {
    seed: 202,
    scenarioId: 'cenario_medio_2eq',
    patientCount: 25,
    teamCount: 2,
    planningHorizonDays: 3,
    maxAnticipationDays: 2,
    centerLat: -30.0346,
    centerLng: -51.2177,
    radiusKm: 4.0,
    overdueFraction: 0.5
  },
  {
    seed: 303,
    scenarioId: 'cenario_grande_4eq',
    patientCount: 50,
    teamCount: 4,
    planningHorizonDays: 3,
    maxAnticipationDays: 2,
    centerLat: -30.0346,
    centerLng: -51.2177,
    radiusKm: 6.0,
    overdueFraction: 0.6
  },
  {
    seed: 404,
    scenarioId: 'cenario_estresse_100p',
    patientCount: 100,
    teamCount: 4,
    planningHorizonDays: 5,
    maxAnticipationDays: 2,
    centerLat: -30.0346,
    centerLng: -51.2177,
    radiusKm: 8.0,
    overdueFraction: 0.6
  },

  // --- Grupo 3: Distribuição Geográfica em Clusters ---
  {
    seed: 505,
    scenarioId: 'cenario_clusters_25p',
    patientCount: 25,
    teamCount: 2,
    planningHorizonDays: 3,
    maxAnticipationDays: 2,
    centerLat: -30.0346,
    centerLng: -51.2177,
    radiusKm: 5.0,
    overdueFraction: 0.5,
    distribution: 'clustered'
  },

  // --- Grupo 4: Casos Limites (Edge Cases) ---
  {
    seed: 606,
    scenarioId: 'cenario_edge_zero_pacientes',
    patientCount: 0,
    teamCount: 2,
    planningHorizonDays: 3,
    maxAnticipationDays: 2,
    centerLat: -30.0346,
    centerLng: -51.2177,
    radiusKm: 2.0,
    overdueFraction: 0.0
  },
  {
    seed: 707,
    scenarioId: 'cenario_edge_um_paciente',
    patientCount: 1,
    teamCount: 1,
    planningHorizonDays: 3,
    maxAnticipationDays: 2,
    centerLat: -30.0346,
    centerLng: -51.2177,
    radiusKm: 1.0,
    overdueFraction: 1.0
  },
  {
    seed: 808,
    scenarioId: 'cenario_edge_borda_poligono',
    patientCount: 5,
    teamCount: 1,
    planningHorizonDays: 3,
    maxAnticipationDays: 2,
    centerLat: -30.0346,
    centerLng: -51.2177,
    radiusKm: 2.0,
    overdueFraction: 0.4,
    placeBoundaryPatient: true
  }
];

console.log('🚀 Gerando a suíte expandida de cenários sintéticos da pesquisa...\n');

for (const cfg of scenariosConfig) {
  const scenario = generateSyntheticScenario(cfg);
  const fileContent = JSON.stringify(scenario, null, 2);
  const filePath = path.join(targetDir, `${scenario.id}.json`);
  fs.writeFileSync(filePath, fileContent, 'utf-8');
  console.log(`  └─ ✅ Cenário [${scenario.id}]: ${scenario.patients.length} pacientes, ${scenario.teams.length} equipes`);
}

console.log(`\n✨ Suíte completa de ${scenariosConfig.length} cenários sintéticos gerada em: ${targetDir}`);
