import { Scenario, Patient } from '../types/index.js';
import { isPointInAnyPolygon } from './polygon.js';

export interface ValidationDiagnostics {
  isValid: boolean;
  eligiblePatients: Patient[];
  outOfTerritoryPatients: Patient[];
  errors: string[];
  warnings: string[];
}

/**
 * Valida o cenário de entrada conforme os requisitos do pipeline:
 * 1. Conferir identificadores, datas, coordenadas, polígonos, intervalos e jornadas.
 * 2. Rejeitar cenários sem território válido.
 * 3. Filtrar pacientes fora da área de atuação (aparecem no diagnóstico, não na otimização).
 */
export function validateScenario(scenario: Scenario): ValidationDiagnostics {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!scenario.id) {
    errors.push('O cenário precisa de um identificador (id).');
  }

  if (!scenario.healthCenter || !scenario.healthCenter.location) {
    errors.push('O cenário deve definir um posto de saúde com localização válida.');
  }

  if (!scenario.polygons || scenario.polygons.length === 0) {
    errors.push('O cenário deve possuir ao menos um polígono de território cadastrado.');
  } else {
    scenario.polygons.forEach((poly, index) => {
      if (!poly.vertices || poly.vertices.length < 3) {
        errors.push(`O polígono ${poly.name || index} possui menos de 3 vértices válidos.`);
      }
    });
  }

  if (!scenario.teams || scenario.teams.length === 0) {
    warnings.push('Nenhuma equipe de saúde foi cadastrada no cenário.');
  }

  if (scenario.planningHorizonDays < 1) {
    errors.push('A janela de planejamento (N) deve ter no mínimo 1 dia útil.');
  }

  if (scenario.maxAnticipationDays < 0) {
    errors.push('A antecipação máxima (A) não pode ser negativa.');
  }

  // Filtragem de pacientes por território
  const eligiblePatients: Patient[] = [];
  const outOfTerritoryPatients: Patient[] = [];

  if (scenario.patients && scenario.patients.length > 0) {
    for (const patient of scenario.patients) {
      if (!patient.location || typeof patient.location.lat !== 'number' || typeof patient.location.lng !== 'number') {
        warnings.push(`Paciente ${patient.code || patient.id} possui coordenadas inválidas.`);
        outOfTerritoryPatients.push(patient);
        continue;
      }

      const isInside = isPointInAnyPolygon(patient.location, scenario.polygons);
      if (isInside) {
        eligiblePatients.push(patient);
      } else {
        outOfTerritoryPatients.push(patient);
      }
    }
  }

  if (outOfTerritoryPatients.length > 0) {
    warnings.push(`${outOfTerritoryPatients.length} paciente(s) estão fora da área delimitada e foram excluídos da otimização.`);
  }

  return {
    isValid: errors.length === 0,
    eligiblePatients,
    outOfTerritoryPatients,
    errors,
    warnings
  };
}
