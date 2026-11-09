import { Scenario, Plan, VisitResult, PlanOptions, Patient } from '@routing/core';

// Em desenvolvimento o Vite (porta 3000) consulta a API na porta 3001; no modo aplicativo,
// a própria API entrega a interface, então o caminho é relativo.
const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:3001/api' : '/api';

export interface ExperimentalScenarioSummary {
  id: string;
  name: string;
  patientCount: number;
  teamCount: number;
  startDate: string;
  planningHorizonDays: number;
}

export interface BaseRegionSummary {
  id: string;
  name: string;
  polygonCount: number;
  healthCenterName: string;
}

export async function fetchBaseRegions(): Promise<BaseRegionSummary[]> {
  const res = await fetch(`${API_BASE_URL}/base-regions`);
  if (!res.ok) throw new Error('Falha ao carregar as regiões GeoSaúde. Verifique se o servidor está ativo.');
  return res.json();
}

export async function fetchBaseRegion(id: string): Promise<Scenario> {
  const res = await fetch(`${API_BASE_URL}/base-regions/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error('Falha ao carregar a região GeoSaúde selecionada.');
  return res.json();
}

export interface RoutingStatus {
  walkingNetworkConfigured: boolean;
  router?: 'internal' | 'osrm' | 'none';
  riskAreasSupported?: boolean;
  detail?: string;
}

export async function fetchRoutingStatus(): Promise<RoutingStatus> {
  const res = await fetch(`${API_BASE_URL}/routing-status`);
  if (!res.ok) throw new Error('Falha ao consultar o roteador de caminhada.');
  return res.json();
}

export interface RoadRoute {
  distanceKm: number;
  durationMinutes: number;
  positions: [number, number][];
  riskAreasCrossed?: string[];
}

export async function fetchRoadRoute(planId: string, date: string, teamId: string, signal: AbortSignal): Promise<RoadRoute> {
  const query = new URLSearchParams({ date, teamId });
  const res = await fetch(`${API_BASE_URL}/plans/${encodeURIComponent(planId)}/road-route?${query}`, { signal });
  if (!res.ok) {
    const body = await res.json() as { error?: string };
    throw new Error(body.error || 'Falha ao consultar a rota viária.');
  }
  const route = await res.json() as RoadRoute;
  if (!Array.isArray(route.positions) || route.positions.length < 2 ||
      route.positions.some(point => !Array.isArray(point) || point.length !== 2 || point.some(value => !Number.isFinite(value)))) {
    throw new Error('O roteador retornou um traçado sem coordenadas válidas.');
  }
  return route;
}

export async function fetchScenarios(): Promise<any[]> {
  const res = await fetch(`${API_BASE_URL}/scenarios`);
  if (!res.ok) throw new Error('Falha ao carregar lista de cenários.');
  return res.json();
}

export async function fetchExperimentalScenarios(): Promise<ExperimentalScenarioSummary[]> {
  const res = await fetch(`${API_BASE_URL}/experimental-scenarios`);
  if (!res.ok) throw new Error('Falha ao carregar cenários experimentais.');
  return res.json();
}

export async function fetchExperimentalScenario(id: string): Promise<Scenario> {
  const res = await fetch(`${API_BASE_URL}/experimental-scenarios/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error('Falha ao carregar o cenário experimental.');
  return res.json();
}

export async function fetchScenarioById(id: string): Promise<Scenario> {
  const res = await fetch(`${API_BASE_URL}/scenarios/${id}`);
  if (!res.ok) throw new Error('Falha ao obter cenário.');
  const json = await res.json();
  return json.data;
}

export async function saveScenario(scenario: Scenario): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/scenarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scenario)
  });
  if (!res.ok) throw new Error('Falha ao salvar cenário.');
  return res.json();
}

export async function generatePlan(scenarioId: string, options: Omit<PlanOptions, 'costMatrix'> & { scenarioVersion?: number }): Promise<Plan> {
  const res = await fetch(`${API_BASE_URL}/scenarios/${scenarioId}/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Falha ao gerar planejamento.');
  }
  return res.json();
}

export async function generateComparison(scenarioId: string, scenarioVersion: number): Promise<Plan[]> {
  const res = await fetch(`${API_BASE_URL}/scenarios/${encodeURIComponent(scenarioId)}/compare`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenarioVersion })
  });
  if (!res.ok) {
    const body = await res.json() as { error?: string; message?: string };
    if (res.status === 404 && body.message?.includes('Route POST:')) {
      throw new Error('O backend em execução está desatualizado. Reinicie a aplicação para ativar a comparação de planos.');
    }
    throw new Error(body.error || 'Falha ao comparar os planos.');
  }
  const body = await res.json() as { plans: Plan[] };
  return body.plans;
}

export async function registerVisitResults(
  scenarioId: string,
  results: VisitResult[],
  currentDate: string,
  options?: Omit<PlanOptions, 'costMatrix'>,
  scenarioVersion?: number
): Promise<{ scenarioVersion: number; scenario: Scenario; plan: Plan }> {
  const res = await fetch(`${API_BASE_URL}/scenarios/${scenarioId}/results`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ results, currentDate, options, scenarioVersion })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Falha ao registrar resultados.');
  }
  return res.json();
}

export function getExportCsvUrl(scenarioId: string, planId: string, date: string, teamId: string): string {
  return `${API_BASE_URL}/export/csv?scenarioId=${scenarioId}&planId=${planId}&date=${date}&teamId=${teamId}`;
}

export function getExportGpxUrl(scenarioId: string, planId: string, date: string, teamId: string): string {
  return `${API_BASE_URL}/export/gpx?scenarioId=${scenarioId}&planId=${planId}&date=${date}&teamId=${teamId}`;
}

export interface IncomingPatient {
  transferId: string;
  fromRegionId: string;
  fromHealthCenterName: string;
  reason?: string;
  createdAt: string;
  patient: Patient;
}

/** Pacientes que outras unidades transferiram para este território. */
export async function fetchIncomingPatients(regionId: string): Promise<IncomingPatient[]> {
  const res = await fetch(`${API_BASE_URL}/base-regions/${encodeURIComponent(regionId)}/incoming-patients`);
  if (!res.ok) throw new Error('Falha ao consultar pacientes transferidos para esta unidade.');
  return res.json();
}

export async function createTransfer(transfer: { fromScenarioId: string; fromRegionId: string; fromHealthCenterName: string;
  toRegionId: string; patient: Patient; reason?: string }): Promise<{ id: string }> {
  const res = await fetch(`${API_BASE_URL}/transfers`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(transfer)
  });
  if (!res.ok) {
    const body = await res.json() as { error?: string };
    throw new Error(body.error || 'Falha ao registrar a transferência.');
  }
  return res.json();
}
