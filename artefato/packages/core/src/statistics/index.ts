import { Patient, Scenario } from '../types/index.js';
import { isPointInPolygon } from '../validation/polygon.js';
import { requiredStaffCount } from '../constraints/index.js';

/** Agrupamento das visitas no tempo. */
export type StatisticsPeriod = 'week' | 'month' | 'year';

export interface StatisticsVisitRecord {
  patientId: string;
  date: string;                       // YYYY-MM-DD da tentativa
  status: 'completed' | 'missed';
  reason?: string;
  teamId?: string;
}

export interface StatisticsTransferRecord {
  date: string;                       // YYYY-MM-DD do registro
  direction: 'out' | 'in';
}

/** Visita retirada de uma rota já planejada (o paciente avisou que estaria fora). */
export interface StatisticsRemovalRecord {
  date: string;
  patientId: string;
  teamId?: string;
  reason?: string;
  mode: 'skip' | 'replan';
}

export interface UsageStatisticsInput {
  scenario?: Scenario;                // Cenário mais recente da unidade (cadastro atual dos pacientes)
  visits: StatisticsVisitRecord[];
  transfers: StatisticsTransferRecord[];
  removals: StatisticsRemovalRecord[];
  period: StatisticsPeriod;
  from?: string;                      // Filtro inclusivo YYYY-MM-DD
  to?: string;
}

export interface UsageStatistics {
  period: StatisticsPeriod;
  from?: string;
  to?: string;
  visits: {
    attempted: number;
    completed: number;
    missed: number;
    missedPercentage: number;
    missedByReason: { reason: string; count: number; percentage: number }[];
    removedFromRoute: number;          // Retiradas antes da visita, por aviso do paciente
  };
  teams: {
    teamId: string;
    teamName: string;
    completedVisits: number;
    patientsServed: number;
    buckets: { period: string; completedVisits: number; patientsServed: number }[];
  }[];
  transfers: { out: number; in: number };
  areas: {
    areaId: string;
    areaName: string;
    patients: number;
    anchors: number;
    hardDeadlines: number;
    withBuffer: number;
    withTimeout: number;
    needsMultipleStaff: number;
  }[];
}

const NO_REASON = 'Sem motivo informado';
const OUTSIDE_AREA = { id: 'fora_do_contorno', name: 'Fora do contorno (incluídos pela equipe)' };

function percentage(part: number, total: number): number {
  return total ? Number(((part / total) * 100).toFixed(1)) : 0;
}

/** Semana ISO 8601 (segunda a domingo) no formato 2026-S41. */
export function isoWeekKey(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  const weekday = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((value.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${value.getUTCFullYear()}-S${String(week).padStart(2, '0')}`;
}

export function periodKey(date: string, period: StatisticsPeriod): string {
  if (period === 'year') return date.slice(0, 4);
  if (period === 'month') return date.slice(0, 7);
  return isoWeekKey(date);
}

function normalizeReason(reason: string | undefined): string {
  const text = (reason ?? '').trim().replace(/\s+/g, ' ');
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : NO_REASON;
}

function inRange(date: string, from?: string, to?: string): boolean {
  return (!from || date >= from) && (!to || date <= to);
}

function hasActiveTimeout(patient: Patient, from: string): boolean {
  return (patient.unavailablePeriods ?? []).some(period => period.kind !== 'skip' && period.end >= from);
}

/**
 * Estatísticas de uso do aplicativo numa unidade: resultado das visitas registradas, motivos das
 * não realizadas, pacientes atendidos por equipe em cada semana/mês/ano, transferências e, pelo
 * cadastro atual, pacientes com âncora, prazo rígido, folga própria ou ausência programada por área.
 */
export function calculateUsageStatistics(input: UsageStatisticsInput): UsageStatistics {
  const visits = input.visits.filter(visit => inRange(visit.date, input.from, input.to));
  const removals = input.removals.filter(removal => inRange(removal.date, input.from, input.to));
  const completed = visits.filter(visit => visit.status === 'completed');
  const missed = visits.filter(visit => visit.status === 'missed');

  const reasonCounts = new Map<string, number>();
  for (const visit of missed) {
    const reason = normalizeReason(visit.reason);
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
  }
  const missedByReason = [...reasonCounts.entries()]
    .map(([reason, count]) => ({ reason, count, percentage: percentage(count, missed.length) }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason, 'pt-BR'));

  const teamNames = new Map((input.scenario?.teams ?? []).map(team => [team.id, team.name]));
  const byTeam = new Map<string, StatisticsVisitRecord[]>();
  for (const visit of completed) {
    const teamId = visit.teamId ?? 'sem_equipe';
    byTeam.set(teamId, [...(byTeam.get(teamId) ?? []), visit]);
  }
  const teams = [...byTeam.entries()].map(([teamId, records]) => {
    const buckets = new Map<string, StatisticsVisitRecord[]>();
    for (const record of records) {
      const key = periodKey(record.date, input.period);
      buckets.set(key, [...(buckets.get(key) ?? []), record]);
    }
    return {
      teamId,
      teamName: teamId === 'sem_equipe' ? 'Equipe não informada' : teamNames.get(teamId) ?? teamId,
      completedVisits: records.length,
      patientsServed: new Set(records.map(record => record.patientId)).size,
      buckets: [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b))
        .map(([period, items]) => ({ period, completedVisits: items.length, patientsServed: new Set(items.map(item => item.patientId)).size }))
    };
  }).sort((a, b) => a.teamName.localeCompare(b.teamName, 'pt-BR'));

  const transfers = input.transfers.filter(transfer => inRange(transfer.date, input.from, input.to));

  const areas: UsageStatistics['areas'] = [];
  const scenario = input.scenario;
  if (scenario) {
    const active = scenario.patients.filter(patient => !patient.transfer);
    const groups = new Map<string, { name: string; patients: Patient[] }>(
      scenario.polygons.map(polygon => [polygon.id, { name: polygon.name, patients: [] }]));
    for (const patient of active) {
      const polygon = scenario.polygons.find(item => isPointInPolygon(patient.location, item));
      if (polygon) groups.get(polygon.id)?.patients.push(patient);
      else if (patient.territoryOverride === 'include') {
        if (!groups.has(OUTSIDE_AREA.id)) groups.set(OUTSIDE_AREA.id, { name: OUTSIDE_AREA.name, patients: [] });
        groups.get(OUTSIDE_AREA.id)?.patients.push(patient);
      }
    }
    for (const [areaId, group] of groups) {
      const list = group.patients;
      areas.push({
        areaId, areaName: group.name, patients: list.length,
        anchors: list.filter(patient => patient.hardDeadline && patient.hardDeadline <= scenario.startDate).length,
        hardDeadlines: list.filter(patient => patient.hardDeadline).length,
        withBuffer: list.filter(patient => (patient.visitBufferMinutes ?? 0) > 0 || (patient.nextVisit?.bufferMinutes ?? 0) > 0).length,
        withTimeout: list.filter(patient => hasActiveTimeout(patient, scenario.startDate)).length,
        needsMultipleStaff: list.filter(patient => requiredStaffCount(patient) > 1 ||
          Object.values(patient.requiredProfessionCounts ?? {}).some(count => (count ?? 0) > 1)).length
      });
    }
  }

  return {
    period: input.period,
    ...(input.from ? { from: input.from } : {}),
    ...(input.to ? { to: input.to } : {}),
    visits: {
      attempted: visits.length,
      completed: completed.length,
      missed: missed.length,
      missedPercentage: percentage(missed.length, visits.length),
      missedByReason,
      removedFromRoute: removals.length
    },
    teams,
    transfers: {
      out: transfers.filter(transfer => transfer.direction === 'out').length,
      in: transfers.filter(transfer => transfer.direction === 'in').length
    },
    areas
  };
}
