import { Scenario } from './types/index.js';
import { planScenario } from './index.js';

const sampleScenario: Scenario = {
  id: 'cenario_exemplo_01',
  version: 1,
  healthCenter: {
    id: 'posto_central',
    name: 'Posto de Saúde Central',
    location: { lat: -30.0346, lng: -51.2177 }
  },
  polygons: [
    {
      id: 'poly_centro',
      name: 'Região Central',
      vertices: [
        { lat: -30.0200, lng: -51.2300 },
        { lat: -30.0200, lng: -51.2000 },
        { lat: -30.0500, lng: -51.2000 },
        { lat: -30.0500, lng: -51.2300 }
      ]
    }
  ],
  patients: [
    {
      id: 'pat_01',
      code: 'P001 - Maria',
      location: { lat: -30.0300, lng: -51.2200 },
      defaultVisitDurationMinutes: 40,
      conditions: [
        { conditionId: 'hipertensao', lastVisitDate: '2026-09-01', maxIntervalDays: 14, priorityWeight: 3 }
      ]
    },
    {
      id: 'pat_02',
      code: 'P002 - João',
      location: { lat: -30.0400, lng: -51.2100 },
      defaultVisitDurationMinutes: 30,
      conditions: [
        { conditionId: 'diabetes', lastVisitDate: '2026-09-05', maxIntervalDays: 10, priorityWeight: 5 }
      ]
    },
    {
      id: 'pat_03',
      code: 'P003 - Ana',
      location: { lat: -30.0250, lng: -51.2150 },
      defaultVisitDurationMinutes: 45,
      conditions: [
        { conditionId: 'curativo', initialDueDate: '2026-09-28', maxIntervalDays: 7, priorityWeight: 4 }
      ]
    }
  ],
  teams: [
    {
      id: 'eq_alpha',
      name: 'Equipe Alpha',
      doctorName: 'Dr. Carlos',
      nurseName: 'Enf. Juliana',
      socialWorkerName: 'AS Roberto',
      dailyWorkMinutes: 240, // 4 horas
      availableDays: ['2026-09-29', '2026-09-30']
    }
  ],
  startDate: '2026-09-29',
  planningHorizonDays: 2,
  maxAnticipationDays: 2
};

// Exemplo didático: o núcleo recebe a matriz pronta; a aplicação usa OSRM a pé.
const distanceMatrix = [
  [0, 1, 2, 0.8], [1, 0, 1.4, 0.7],
  [2, 1.4, 0, 1.6], [0.8, 0.7, 1.6, 0]
];
const costMatrix = {
  nodeIds: ['posto_central', 'pat_01', 'pat_02', 'pat_03'],
  distanceMatrix,
  timeMatrix: distanceMatrix.map(row => row.map(km => km * 12))
};

console.log('=== TESTANDO O PIPELINE DO CORE DO FRAMEWORK DE ROTEAMENTO ===\n');

try {
  console.log('1. Gerando Plano com a Heurística Principal...');
  const planHeuristic = planScenario(sampleScenario, { strategyId: 'main-heuristic', costMatrix });
  console.log(`Plano gerado com sucesso! (ID: ${planHeuristic.id})`);
  console.log('Métricas:', planHeuristic.metrics);
  console.log('Rotas:', JSON.stringify(planHeuristic.routes, null, 2));

  console.log('\n2. Gerando Plano com a Baseline de Urgência...');
  const planUrgency = planScenario(sampleScenario, { strategyId: 'urgency-baseline', costMatrix });
  console.log('Métricas Urgência:', planUrgency.metrics);

  console.log('\n3. Gerando Plano com a Baseline de Vizinho Mais Próximo...');
  const planNearest = planScenario(sampleScenario, { strategyId: 'nearest-baseline', costMatrix });
  console.log('Métricas Vizinho Próximo:', planNearest.metrics);

} catch (err: any) {
  console.error('Erro durante o teste:', err.message);
}
