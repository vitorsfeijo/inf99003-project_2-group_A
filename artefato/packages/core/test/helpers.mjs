// Cenários pequenos para os testes: pacientes em linha a partir do posto, e o custo entre
// dois nós é a diferença de posição (minutos e km iguais), o que torna as contas fáceis de conferir.

export const STRATEGIES = ['main-heuristic', 'nearest-baseline', 'urgency-baseline'];

export function lineScenario(patients, overrides = {}) {
  return {
    id: 'limites', version: 1,
    healthCenter: { id: 'posto', name: 'Posto', location: { lat: -30, lng: -51 } },
    polygons: [{ id: 'area', name: 'Área', vertices: [
      { lat: -30.1, lng: -51.1 }, { lat: -30.1, lng: -50.9 },
      { lat: -29.9, lng: -50.9 }, { lat: -29.9, lng: -51.1 }
    ] }],
    patients: patients.map((patient, index) => ({
      code: patient.id.toUpperCase(), location: { lat: -30, lng: -51.001 - index * 0.001 },
      defaultVisitDurationMinutes: 30,
      conditions: [{ conditionId: 'c', initialDueDate: patient.due ?? '2026-10-08', maxIntervalDays: 30,
        priorityWeight: patient.weight ?? 3 }],
      ...patient.extra, id: patient.id
    })),
    teams: [{ id: 'equipe', name: 'Equipe', dailyWorkMinutes: 70, availableDays: [] }],
    startDate: '2026-10-08', planningHorizonDays: 3, maxAnticipationDays: 0,
    ...overrides
  };
}

/** Matriz em linha para os pacientes elegíveis (sem os transferidos). */
export function lineMatrix(scenario, scale = 1) {
  const ids = ['posto', ...scenario.patients.filter(patient => !patient.transfer).map(patient => patient.id)];
  const matrix = ids.map((_, from) => ids.map((__, to) => Math.abs(from - to) * scale));
  return { nodeIds: ids, distanceMatrix: matrix, timeMatrix: matrix.map(row => [...row]) };
}

export const visitsOf = plan => plan.routes.flatMap(route => route.visits.map(visit => ({ ...visit, date: route.date, teamId: route.teamId })));
export const dayOf = (plan, patientId) => visitsOf(plan).find(visit => visit.patientId === patientId)?.date;
export const teamOf = (plan, patientId) => visitsOf(plan).find(visit => visit.patientId === patientId)?.teamId;
export const pendingOf = (plan, patientId) => plan.unallocatedVisits.find(item => item.patientId === patientId);

/** PRNG Mulberry32, o mesmo da bancada experimental: a mesma semente gera os mesmos cenários. */
export function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6D2B79F5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
