import { Scenario, Plan, VisitResult, PlanOptions } from '@routing/core';

const API_BASE_URL = 'http://localhost:3001/api';

export interface ExperimentalScenarioSummary {
  id: string;
  name: string;
  patientCount: number;
  teamCount: number;
  startDate: string;
  planningHorizonDays: number;
}

export async function fetchScenarios(): Promise<any[]> {
  const res = await fetch(`${API_BASE_URL}/scenarios`);
  if (!res.ok) throw new Error('Falha ao carregar lista de cenários.');
  return res.json();
}

export async function fetchExperimentalScenarios(): Promise<ExperimentalScenarioSummary[]> {
  const res = await fetch(`${API_BASE_URL}/experimental-scenarios`);
  if (!res.ok) throw new Error('Falha ao carregar cenÃ¡rios experimentais.');
  return res.json();
}

export async function fetchExperimentalScenario(id: string): Promise<Scenario> {
  const res = await fetch(`${API_BASE_URL}/experimental-scenarios/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error('Falha ao carregar o cenÃ¡rio experimental.');
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

export async function generatePlan(scenarioId: string, options: PlanOptions): Promise<Plan> {
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

export async function registerVisitResults(
  scenarioId: string,
  results: VisitResult[],
  currentDate: string,
  options?: PlanOptions
): Promise<{ scenarioVersion: number; plan: Plan }> {
  const res = await fetch(`${API_BASE_URL}/scenarios/${scenarioId}/results`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ results, currentDate, options })
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
