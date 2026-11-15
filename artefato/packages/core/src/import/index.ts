// Importação de pacientes a partir de uma planilha (CSV ou Excel, já convertida em linhas) ou de um JSON.
// Funções puras: a leitura do arquivo fica com quem chama; aqui só se interpretam os valores.
// Cada linha com problema é recusada com o motivo, e as demais seguem.

import { Coordinates, HealthCenter, Patient, PatientCondition, ProfessionId, Team, TerritoryPolygon, UnavailablePeriod } from '../types/index.js';
import { PROFESSIONS } from '../constraints/index.js';
import { isPointInAnyPolygon } from '../validation/polygon.js';
import { validateScenario } from '../validation/scenario.js';

export type TableCell = string | number | boolean | null | undefined;

export interface ImportIssue {
  where: string;                 // "Linha 5", "Item 3" ou "Arquivo"
  message: string;
}

export interface PatientImportContext {
  healthCenter: HealthCenter;
  polygons: TerritoryPolygon[];
  teams: Team[];
  startDate: string;             // Usada como primeiro prazo quando a linha não informa datas
  existingPatients?: Patient[];  // Pacientes com o mesmo código mantêm o identificador
  maxDistanceKm?: number;        // Distância máxima do posto (padrão 50 km)
}

export interface PatientImportResult {
  patients: Patient[];
  errors: ImportIssue[];         // Linhas recusadas
  warnings: ImportIssue[];       // Linhas aceitas com observação
  rowsRead: number;
}

export interface ImportColumn {
  key: string;
  header: string;
  aliases: string[];
  required: boolean;
  description: string;
}

/** Colunas aceitas. O cabeçalho é comparado sem acentos, maiúsculas ou pontuação. */
export const PATIENT_IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'code', header: 'codigo', aliases: ['code', 'paciente', 'id', 'identificador', 'cod'], required: true,
    description: 'Código do paciente na unidade. Repita o código em outra linha para cadastrar outra condição do mesmo paciente.' },
  { key: 'lat', header: 'latitude', aliases: ['lat'], required: true, description: 'Latitude do domicílio, em graus decimais (ex.: -30,0346).' },
  { key: 'lng', header: 'longitude', aliases: ['lng', 'lon', 'long'], required: true, description: 'Longitude do domicílio, em graus decimais (ex.: -51,2177).' },
  { key: 'duration', header: 'duracao_min', aliases: ['duracao', 'duracao_minutos', 'duration', 'tempo_atendimento'], required: false,
    description: 'Duração do atendimento em minutos. Vazio: 30.' },
  { key: 'buffer', header: 'folga_min', aliases: ['folga', 'folga_minutos', 'buffer'], required: false,
    description: 'Folga própria do paciente após a visita, em minutos. Vazio: vale a folga geral do cenário.' },
  { key: 'condition', header: 'condicao', aliases: ['condition', 'condicao_id', 'cuidado', 'linha_de_cuidado'], required: false,
    description: 'Nome da condição acompanhada (ex.: hipertensao). Vazio: cond_principal.' },
  { key: 'priority', header: 'prioridade', aliases: ['peso', 'priority', 'peso_clinico'], required: false,
    description: 'Prioridade clínica de 1 a 5. Vazio: 3.' },
  { key: 'interval', header: 'intervalo_max_dias', aliases: ['intervalo', 'intervalo_dias', 'intervalo_maximo', 'max_interval_days'], required: false,
    description: 'Intervalo máximo entre visitas, em dias corridos (1 a 365). Vazio: 30.' },
  { key: 'lastVisit', header: 'ultima_visita', aliases: ['data_ultima_visita', 'last_visit_date'], required: false,
    description: 'Data da última visita concluída (AAAA-MM-DD ou DD/MM/AAAA). O prazo é essa data mais o intervalo.' },
  { key: 'firstDue', header: 'primeiro_prazo', aliases: ['prazo', 'proximo_prazo', 'initial_due_date'], required: false,
    description: 'Prazo da primeira visita, se o paciente nunca foi visitado. Sem esta data e sem última visita: o primeiro dia do planejamento.' },
  { key: 'hardDeadline', header: 'prazo_rigido', aliases: ['ancora', 'data_ancora', 'hard_deadline'], required: false,
    description: 'Data limite que não pode ser ultrapassada. O primeiro dia do planejamento torna a visita uma âncora.' },
  { key: 'professions', header: 'categorias', aliases: ['categorias_exigidas', 'profissoes', 'profissionais_exigidos'], required: false,
    description: 'Categorias que precisam ir à visita, separadas por ";". Para exigir mais de um da mesma categoria, use ":" (ex.: tecnico_enfermagem:2; enfermagem).' },
  { key: 'staff', header: 'profissionais', aliases: ['n_profissionais', 'numero_profissionais', 'total_profissionais'], required: false,
    description: 'Total de profissionais na visita (ex.: 2 para mobilizar um acamado). Vazio: 1.' },
  { key: 'team', header: 'equipe', aliases: ['equipe_vinculada', 'vinculo', 'team'], required: false,
    description: 'Nome ou identificador da única equipe que pode visitar o paciente. Precisa existir no cenário.' },
  { key: 'awayStart', header: 'ausencia_inicio', aliases: ['ausente_de', 'inicio_ausencia'], required: false,
    description: 'Primeiro dia em que o paciente está fora (férias, internação, viagem).' },
  { key: 'awayEnd', header: 'ausencia_fim', aliases: ['ausente_ate', 'fim_ausencia'], required: false,
    description: 'Último dia da ausência. Vazio: só o dia de início.' },
  { key: 'awayReason', header: 'ausencia_motivo', aliases: ['motivo_ausencia'], required: false, description: 'Motivo da ausência (opcional).' }
];

const DEFAULT_DURATION_MINUTES = 30;
const DEFAULT_INTERVAL_DAYS = 30;
const DEFAULT_PRIORITY = 3;
const DEFAULT_CONDITION = 'cond_principal';
const DEFAULT_MAX_DISTANCE_KM = 50;

/** Texto em minúsculas, sem acentos e com a pontuação trocada por "_". */
function normalizeKey(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

const COLUMN_BY_HEADER = new Map<string, ImportColumn>();
for (const column of PATIENT_IMPORT_COLUMNS) {
  for (const name of [column.header, ...column.aliases]) COLUMN_BY_HEADER.set(normalizeKey(name), column);
}

const PROFESSION_SYNONYMS: Record<string, ProfessionId> = {
  agente_comunitario: 'acs', agente_comunitario_de_saude: 'acs', agente: 'acs',
  enfermeiro: 'enfermagem', enfermeira: 'enfermagem',
  tecnico_de_enfermagem: 'tecnico_enfermagem', tecnica_de_enfermagem: 'tecnico_enfermagem', tecnico: 'tecnico_enfermagem', tecnica: 'tecnico_enfermagem',
  auxiliar_de_enfermagem: 'tecnico_enfermagem',
  medico: 'medicina', medica: 'medicina',
  dentista: 'odontologia', cirurgiao_dentista: 'odontologia',
  saude_bucal: 'saude_bucal', auxiliar_de_saude_bucal: 'saude_bucal', tecnico_de_saude_bucal: 'saude_bucal', asb: 'saude_bucal', tsb: 'saude_bucal',
  assistente_social: 'servico_social', psicologo: 'psicologia', psicologa: 'psicologia',
  fisioterapeuta: 'fisioterapia', nutricionista: 'nutricao'
};
const PROFESSION_BY_NAME = new Map<string, ProfessionId>(Object.entries(PROFESSION_SYNONYMS));
for (const profession of PROFESSIONS) {
  PROFESSION_BY_NAME.set(normalizeKey(profession.id), profession.id);
  PROFESSION_BY_NAME.set(normalizeKey(profession.label), profession.id);
}

// --- CSV ---

/**
 * Lê um CSV (RFC 4180) e devolve as linhas. O separador é detectado na primeira linha:
 * ";" (padrão do Excel em português), "," ou tabulação. Aspas permitem separadores e quebras de linha no valor.
 */
export function parseCsv(text: string): string[][] {
  const content = text.replace(/^﻿/, '');
  const delimiter = detectDelimiter(content);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < content.length; index++) {
    const char = content[index];
    if (quoted) {
      if (char === '"') {
        if (content[index + 1] === '"') { field += '"'; index++; } else quoted = false;
      } else field += char;
    } else if (char === '"' && field === '') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field); field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && content[index + 1] === '\n') index++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += char;
  }
  if (quoted) throw new Error('O CSV termina com aspas abertas: confira se todo valor entre aspas foi fechado.');
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function detectDelimiter(content: string): string {
  const counts = new Map<string, number>([[';', 0], [',', 0], ['\t', 0]]);
  let quoted = false;
  for (const char of content) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && (char === '\n' || char === '\r')) break;
    else if (!quoted && counts.has(char)) counts.set(char, counts.get(char)! + 1);
  }
  const [best, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return count > 0 ? best : ';';
}

// --- Valores ---

class RowError extends Error {}

function text(value: TableCell): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function parseNumber(value: TableCell, label: string): number | undefined {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new RowError(`${label} inválido (${value}).`);
    return value;
  }
  let raw = text(value).replace(/\s/g, '');
  if (!raw) return undefined;
  if (raw.includes(',') && raw.includes('.')) raw = raw.replace(/\./g, '').replace(',', '.');
  else raw = raw.replace(',', '.');
  const parsed = Number(raw);
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(raw) || !Number.isFinite(parsed)) throw new RowError(`${label} não é um número: "${text(value)}".`);
  return parsed;
}

function parseInteger(value: TableCell, label: string, minimum: number, maximum = Number.MAX_SAFE_INTEGER): number | undefined {
  const parsed = parseNumber(value, label);
  if (parsed === undefined) return undefined;
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new RowError(`${label} deve ser um número inteiro de ${minimum}${maximum < Number.MAX_SAFE_INTEGER ? ` a ${maximum}` : ' em diante'} (veio "${text(value)}").`);
  }
  return parsed;
}

function isRealDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * Datas aceitas: AAAA-MM-DD, DD/MM/AAAA, DD-MM-AAAA, DD/MM/AA e o número de série do Excel
 * (célula formatada como data). O horário de um ISO completo é descartado.
 */
export function parseImportDate(value: TableCell, label = 'Data'): string | undefined {
  if (typeof value === 'number') {
    // Número de série do Excel; a fração é o horário e é descartada.
    if (!Number.isFinite(value) || value < 1 || value >= 2958466) throw new RowError(`${label} inválida (${value}).`);
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000);
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  }
  const raw = text(value);
  if (!raw) return undefined;
  let year: number, month: number, day: number;
  let match = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T ].*)?$/);
  if (match) {
    [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/))) {
    [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (match[3].length === 2) year += 2000;
  } else {
    throw new RowError(`${label} em formato desconhecido: "${raw}". Use AAAA-MM-DD ou DD/MM/AAAA.`);
  }
  if (!isRealDate(year, month, day)) throw new RowError(`${label} não existe no calendário: "${raw}".`);
  return `${year}-${pad(month)}-${pad(day)}`;
}

function parseProfessions(value: TableCell): { ids: ProfessionId[]; counts: Partial<Record<ProfessionId, number>> } {
  const ids: ProfessionId[] = [];
  const counts: Partial<Record<ProfessionId, number>> = {};
  for (const token of text(value).split(/[;,|\n]+/).map(item => item.trim()).filter(Boolean)) {
    let name = token;
    let count = 1;
    const before = token.match(/^(\d+)\s*[x×]?\s+(.+)$/i);
    const after = token.match(/^(.+?)\s*(?:[:=×]|\bx)\s*(\d+)$/i) ?? token.match(/^(.+?)\s*\((\d+)\)$/);
    if (before) { count = Number(before[1]); name = before[2]; } else if (after) { name = after[1]; count = Number(after[2]); }
    // Aceita o plural ("2 técnicos de enfermagem").
    const id = PROFESSION_BY_NAME.get(normalizeKey(name)) ?? PROFESSION_BY_NAME.get(normalizeKey(name).replace(/s(_|$)/g, '$1'));
    if (!id) {
      throw new RowError(`Categoria desconhecida: "${name.trim()}". Use um destes códigos: ${PROFESSIONS.map(item => item.id).join(', ')}.`);
    }
    if (!Number.isInteger(count) || count < 1) throw new RowError(`Quantidade inválida para ${id}: ${count}.`);
    if (!ids.includes(id)) ids.push(id);
    if (count > 1) counts[id] = Math.max(counts[id] ?? 1, count);
  }
  return { ids, counts };
}

function findTeam(value: TableCell, teams: Team[]): string | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  const team = teams.find(item => item.id === raw) ?? teams.find(item => normalizeKey(item.name) === normalizeKey(raw));
  if (!team) {
    throw new RowError(`A equipe "${raw}" não existe no cenário${teams.length ? ` (equipes: ${teams.map(item => item.name).join(', ')})` : ', que ainda não tem equipes'}.`);
  }
  return team.id;
}

function distanceKm(a: Coordinates, b: Coordinates): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function checkLocation(location: Coordinates, context: PatientImportContext): void {
  if (location.lat < -90 || location.lat > 90 || location.lng < -180 || location.lng > 180) {
    throw new RowError(`Coordenadas fora do globo (${location.lat}, ${location.lng}).`);
  }
  const limit = context.maxDistanceKm ?? DEFAULT_MAX_DISTANCE_KM;
  const distance = distanceKm(location, context.healthCenter.location);
  if (distance > limit) {
    const swapped = distanceKm({ lat: location.lng, lng: location.lat }, context.healthCenter.location) <= limit;
    throw new RowError(`O endereço fica a ${Math.round(distance)} km do posto (limite: ${limit} km).`
      + (swapped ? ' Latitude e longitude parecem estar trocadas.' : ' Confira as coordenadas.'));
  }
}

// --- Montagem dos pacientes ---

interface Accumulator {
  context: PatientImportContext;
  patients: Patient[];
  byCode: Map<string, { patient: Patient; where: string; signature: string }>;
  usedIds: Set<string>;
  existingIdByCode: Map<string, string>;
  errors: ImportIssue[];
  warnings: ImportIssue[];
  outside: string[];
}

function createAccumulator(context: PatientImportContext): Accumulator {
  const existing = context.existingPatients ?? [];
  return {
    context, patients: [], byCode: new Map(), errors: [], warnings: [], outside: [],
    usedIds: new Set(existing.map(patient => patient.id)),
    existingIdByCode: new Map(existing.map(patient => [normalizeKey(patient.code), patient.id]))
  };
}

function patientIdFor(code: string, acc: Accumulator): string {
  const existingId = acc.existingIdByCode.get(normalizeKey(code));
  if (existingId) return existingId;
  const base = `imp_${normalizeKey(code) || 'paciente'}`;
  let id = base;
  for (let suffix = 2; acc.usedIds.has(id); suffix++) id = `${base}_${suffix}`;
  acc.usedIds.add(id);
  return id;
}

/** Confere o paciente com as mesmas regras do planejamento, para que o erro apareça já na importação. */
function checkWithScenarioRules(patient: Patient, context: PatientImportContext): void {
  const diagnostics = validateScenario({
    id: 'importacao', version: 1, healthCenter: context.healthCenter, polygons: context.polygons, teams: context.teams,
    patients: [patient], startDate: context.startDate, planningHorizonDays: 1, maxAnticipationDays: 0
  });
  const patientErrors = diagnostics.errors.filter(message => message.includes(patient.code) || message.includes(patient.id));
  if (patientErrors.length) throw new RowError(patientErrors.join(' '));
}

function addPatient(patient: Patient, where: string, signature: string, acc: Accumulator): void {
  checkLocation(patient.location, acc.context);
  if (!patient.territoryOverride && !isPointInAnyPolygon(patient.location, acc.context.polygons)) {
    // A lista veio da própria unidade: o paciente pertence a ela mesmo fora do contorno do GeoSaúde.
    patient.territoryOverride = 'include';
    acc.outside.push(patient.code);
  }
  checkWithScenarioRules(patient, acc.context);
  acc.patients.push(patient);
  acc.byCode.set(normalizeKey(patient.code), { patient, where, signature });
}

function finish(acc: Accumulator, rowsRead: number): PatientImportResult {
  if (acc.outside.length) {
    acc.warnings.push({ where: 'Arquivo', message: `${acc.outside.length} paciente(s) ficam fora do contorno do GeoSaúde e foram incluídos mesmo assim, porque vieram da lista da unidade: ${acc.outside.slice(0, 12).join(', ')}${acc.outside.length > 12 ? '…' : ''}.` });
  }
  if (rowsRead > 0 && !acc.patients.length && !acc.errors.length) {
    acc.errors.push({ where: 'Arquivo', message: 'Nenhum paciente encontrado no arquivo.' });
  }
  return { patients: acc.patients, errors: acc.errors, warnings: acc.warnings, rowsRead };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Converte as linhas de uma planilha (a primeira linha preenchida é o cabeçalho) em pacientes.
 * Linhas com o mesmo código viram condições do mesmo paciente.
 */
export function patientsFromTable(rows: TableCell[][], context: PatientImportContext): PatientImportResult {
  const acc = createAccumulator(context);
  const headerIndex = rows.findIndex(row => row.some(cell => text(cell) !== ''));
  if (headerIndex < 0) return finish(acc, 0);

  const columns = new Map<string, number>();
  rows[headerIndex].forEach((cell, index) => {
    const name = text(cell);
    if (!name) return;
    const column = COLUMN_BY_HEADER.get(normalizeKey(name));
    if (!column) {
      acc.warnings.push({ where: 'Cabeçalho', message: `A coluna "${name}" não é reconhecida e foi ignorada.` });
    } else if (columns.has(column.key)) {
      acc.warnings.push({ where: 'Cabeçalho', message: `A coluna "${name}" repete "${column.header}"; vale a primeira.` });
    } else {
      columns.set(column.key, index);
    }
  });
  const missing = PATIENT_IMPORT_COLUMNS.filter(column => column.required && !columns.has(column.key));
  if (missing.length) {
    acc.errors.push({ where: 'Cabeçalho', message: `Faltam as colunas obrigatórias: ${missing.map(column => column.header).join(', ')}. Baixe o modelo para ver os nomes aceitos.` });
    return finish(acc, rows.length - headerIndex - 1);
  }

  let rowsRead = 0;
  for (let index = headerIndex + 1; index < rows.length; index++) {
    const row = rows[index];
    if (!row.some(cell => text(cell) !== '')) continue;
    rowsRead++;
    const where = `Linha ${index + 1}`;
    const cell = (key: string): TableCell => columns.has(key) ? row[columns.get(key)!] : undefined;
    try {
      addTableRow(cell, where, acc);
    } catch (error) {
      if (!(error instanceof RowError)) throw error;
      acc.errors.push({ where, message: messageOf(error) });
    }
  }
  return finish(acc, rowsRead);
}

function addTableRow(cell: (key: string) => TableCell, where: string, acc: Accumulator): void {
  const { context } = acc;
  const code = text(cell('code'));
  if (!code) throw new RowError('Falta o código do paciente.');

  const lastVisitDate = parseImportDate(cell('lastVisit'), 'Última visita');
  const initialDueDate = parseImportDate(cell('firstDue'), 'Primeiro prazo');
  const condition: PatientCondition = {
    conditionId: text(cell('condition')) || DEFAULT_CONDITION,
    maxIntervalDays: parseInteger(cell('interval'), 'Intervalo máximo', 1, 365) ?? DEFAULT_INTERVAL_DAYS,
    priorityWeight: parseInteger(cell('priority'), 'Prioridade', 1, 5) ?? DEFAULT_PRIORITY,
    ...(lastVisitDate ? { lastVisitDate } : {}),
    ...(initialDueDate || !lastVisitDate ? { initialDueDate: initialDueDate ?? context.startDate } : {})
  };

  // Campos do paciente (não da condição): nas linhas seguintes do mesmo código, devem repetir ou ficar vazios.
  const patientFields = ['lat', 'lng', 'duration', 'buffer', 'hardDeadline', 'professions', 'staff', 'team', 'awayStart', 'awayEnd', 'awayReason'];
  const signature = patientFields.map(key => text(cell(key))).join('\u0001');
  const previous = acc.byCode.get(normalizeKey(code));
  if (previous) {
    if (previous.patient.conditions.some(item => item.conditionId === condition.conditionId)) {
      throw new RowError(`O paciente ${code} já tem a condição "${condition.conditionId}" (${previous.where}). Dê outro nome à condição ou remova a linha repetida.`);
    }
    const filled = patientFields.some(key => text(cell(key)) !== '');
    if (filled && signature !== previous.signature) {
      acc.warnings.push({ where, message: `Os dados do paciente ${code} diferem dos da ${previous.where.toLowerCase()}; valem os da primeira linha. Desta linha entrou só a condição.` });
    }
    previous.patient.conditions.push(condition);
    return;
  }

  const lat = parseNumber(cell('lat'), 'Latitude');
  const lng = parseNumber(cell('lng'), 'Longitude');
  if (lat === undefined || lng === undefined) throw new RowError('Faltam latitude e/ou longitude.');
  const duration = parseInteger(cell('duration'), 'Duração', 1, 600);
  const buffer = parseInteger(cell('buffer'), 'Folga', 0, 600);
  const hardDeadline = parseImportDate(cell('hardDeadline'), 'Prazo rígido');
  const professions = parseProfessions(cell('professions'));
  const staff = parseInteger(cell('staff'), 'Número de profissionais', 1, 20);
  const assignedTeamId = findTeam(cell('team'), context.teams);
  const awayStart = parseImportDate(cell('awayStart'), 'Início da ausência');
  const awayEnd = parseImportDate(cell('awayEnd'), 'Fim da ausência');
  const awayReason = text(cell('awayReason'));
  if (awayEnd && !awayStart) throw new RowError('A ausência tem fim, mas não tem início.');
  if (awayStart && awayEnd && awayEnd < awayStart) throw new RowError(`A ausência termina (${awayEnd}) antes de começar (${awayStart}).`);
  if (hardDeadline && hardDeadline < context.startDate) {
    acc.warnings.push({ where, message: `O prazo rígido de ${code} (${hardDeadline}) já passou; a visita será tratada como âncora no primeiro dia.` });
  }
  const staffNeeded = professions.ids.reduce((sum, id) => sum + (professions.counts[id] ?? 1), 0);
  if (staff !== undefined && staff < staffNeeded) {
    acc.warnings.push({ where, message: `${code} exige ${staffNeeded} profissionais pelas categorias, mais que os ${staff} informados; só uma equipe com ao menos ${staffNeeded} poderá ir.` });
  }

  const unavailablePeriods: UnavailablePeriod[] = awayStart
    ? [{ start: awayStart, end: awayEnd ?? awayStart, kind: 'timeout', ...(awayReason ? { reason: awayReason } : {}) }]
    : [];
  const patient: Patient = {
    id: patientIdFor(code, acc), code, location: { lat, lng },
    conditions: [condition],
    defaultVisitDurationMinutes: duration ?? DEFAULT_DURATION_MINUTES,
    ...(buffer !== undefined ? { visitBufferMinutes: buffer } : {}),
    ...(professions.ids.length ? { requiredProfessions: professions.ids } : {}),
    ...(Object.keys(professions.counts).length ? { requiredProfessionCounts: professions.counts } : {}),
    ...(staff !== undefined && staff > 1 ? { requiredStaffCount: staff } : {}),
    ...(hardDeadline ? { hardDeadline } : {}),
    ...(assignedTeamId ? { assignedTeamId } : {}),
    ...(unavailablePeriods.length ? { unavailablePeriods } : {})
  };
  addPatient(patient, where, signature, acc);
}

// --- JSON ---

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Aceita: uma lista de pacientes no formato do aplicativo; um objeto com "patients" (um cenário exportado);
 * ou uma lista de objetos com as mesmas colunas da planilha.
 */
export function patientsFromJson(value: unknown, context: PatientImportContext): PatientImportResult {
  let items: unknown[];
  const notes: ImportIssue[] = [];
  if (Array.isArray(value)) {
    items = value;
  } else if (isObject(value) && Array.isArray(value.patients)) {
    items = value.patients;
    const ignored = ['teams', 'riskAreas', 'polygons', 'healthCenter'].filter(key => key in value);
    if (ignored.length) notes.push({ where: 'Arquivo', message: 'Do arquivo, só os pacientes foram importados; equipes, contornos e regras continuam os do cenário atual.' });
  } else {
    const acc = createAccumulator(context);
    acc.errors.push({ where: 'Arquivo', message: 'O JSON deve ser uma lista de pacientes ou um objeto com a lista "patients".' });
    return finish(acc, 0);
  }

  const appItems = items.filter(item => isObject(item) && isObject(item.location));
  const rowItems = items.filter(item => isObject(item) && !isObject(item.location));
  const acc = createAccumulator(context);
  acc.warnings.push(...notes);

  if (rowItems.length) {
    // Objetos "planos" seguem as regras da planilha; o cabeçalho é a união das chaves.
    const keys = [...new Set(rowItems.flatMap(item => Object.keys(item as Record<string, unknown>)))];
    const rows: TableCell[][] = [keys, ...rowItems.map(item => keys.map(key => toCell((item as Record<string, unknown>)[key])))];
    const table = patientsFromTable(rows, { ...context, existingPatients: [...(context.existingPatients ?? []), ...acc.patients] });
    const itemNumber = (where: string) => {
      const line = Number(where.replace('Linha ', ''));
      return Number.isFinite(line) ? `Item ${items.indexOf(rowItems[line - 2]) + 1}` : where;
    };
    acc.errors.push(...table.errors.map(issue => ({ ...issue, where: itemNumber(issue.where) })));
    acc.warnings.push(...table.warnings.filter(issue => !issue.message.includes('fora do contorno')).map(issue => ({ ...issue, where: itemNumber(issue.where) })));
    for (const patient of table.patients) {
      acc.patients.push(patient);
      acc.byCode.set(normalizeKey(patient.code), { patient, where: 'JSON', signature: '' });
      acc.usedIds.add(patient.id);
      if (patient.territoryOverride === 'include' && !isPointInAnyPolygon(patient.location, context.polygons)) acc.outside.push(patient.code);
    }
  }

  items.forEach((item, index) => {
    if (!isObject(item)) acc.errors.push({ where: `Item ${index + 1}`, message: 'Não é um objeto de paciente.' });
  });
  for (const item of appItems) {
    const where = `Item ${items.indexOf(item) + 1}`;
    try {
      const patient = appPatient(item as Record<string, unknown>, acc);
      if (acc.byCode.has(normalizeKey(patient.code))) throw new RowError(`O código ${patient.code} aparece mais de uma vez no arquivo.`);
      addPatient(patient, where, '', acc);
    } catch (error) {
      if (!(error instanceof RowError)) throw error;
      acc.errors.push({ where, message: messageOf(error) });
    }
  }
  return finish(acc, items.length);
}

function toCell(value: unknown): TableCell {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(String).join('; ');
  return JSON.stringify(value);
}

/** Paciente no formato do aplicativo: confere tipos e datas, e normaliza o identificador. */
function appPatient(item: Record<string, unknown>, acc: Accumulator): Patient {
  const code = text(item.code as TableCell) || text(item.id as TableCell);
  if (!code) throw new RowError('O paciente não tem "code" nem "id".');
  const location = item.location as Record<string, unknown>;
  if (typeof location.lat !== 'number' || typeof location.lng !== 'number') throw new RowError(`${code}: "location" precisa de "lat" e "lng" numéricos.`);
  if (!Array.isArray(item.conditions) || !item.conditions.length) throw new RowError(`${code}: falta a lista "conditions" com ao menos uma condição.`);
  const conditions = item.conditions.map((raw, index) => {
    if (!isObject(raw)) throw new RowError(`${code}: a condição ${index + 1} não é um objeto.`);
    const maxIntervalDays = raw.maxIntervalDays;
    const priorityWeight = raw.priorityWeight;
    if (typeof maxIntervalDays !== 'number' || !Number.isInteger(maxIntervalDays) || maxIntervalDays < 1) throw new RowError(`${code}: "maxIntervalDays" deve ser um inteiro a partir de 1.`);
    if (typeof priorityWeight !== 'number' || !(priorityWeight > 0)) throw new RowError(`${code}: "priorityWeight" deve ser um número positivo.`);
    const lastVisitDate = parseImportDate(raw.lastVisitDate as TableCell, `${code}: lastVisitDate`);
    const initialDueDate = parseImportDate(raw.initialDueDate as TableCell, `${code}: initialDueDate`);
    return {
      conditionId: text(raw.conditionId as TableCell) || `cond_${index + 1}`, maxIntervalDays, priorityWeight,
      ...(lastVisitDate ? { lastVisitDate } : {}),
      ...(initialDueDate || !lastVisitDate ? { initialDueDate: initialDueDate ?? acc.context.startDate } : {})
    } as PatientCondition;
  });
  const hardDeadline = parseImportDate(item.hardDeadline as TableCell, `${code}: hardDeadline`);
  const periods = Array.isArray(item.unavailablePeriods) ? item.unavailablePeriods.map((raw, index) => {
    if (!isObject(raw)) throw new RowError(`${code}: a ausência ${index + 1} não é um objeto.`);
    const start = parseImportDate(raw.start as TableCell, `${code}: início da ausência`);
    const end = parseImportDate(raw.end as TableCell, `${code}: fim da ausência`) ?? start;
    if (!start) throw new RowError(`${code}: a ausência ${index + 1} não tem início.`);
    return { ...raw, start, end } as UnavailablePeriod;
  }) : undefined;
  if (item.assignedTeamId !== undefined && !acc.context.teams.some(team => team.id === item.assignedTeamId)) {
    throw new RowError(`${code}: a equipe "${String(item.assignedTeamId)}" não existe no cenário.`);
  }
  const { id: _id, ...rest } = item;
  return {
    ...(rest as unknown as Patient),
    id: patientIdFor(code, acc), code, location: { lat: location.lat, lng: location.lng }, conditions,
    defaultVisitDurationMinutes: typeof item.defaultVisitDurationMinutes === 'number' ? item.defaultVisitDurationMinutes : DEFAULT_DURATION_MINUTES,
    ...(hardDeadline ? { hardDeadline } : {}),
    ...(periods ? { unavailablePeriods: periods } : {})
  };
}

// --- Aplicação ao cenário ---

export type PatientImportMode = 'add' | 'replace';

export interface PatientMergeResult {
  patients: Patient[];
  added: number;
  updated: number;
  removed: number;
}

/**
 * Junta os pacientes importados aos atuais. Em "add", o mesmo código atualiza o cadastro;
 * em "replace", quem não está no arquivo sai. A transferência, o ajuste da próxima visita
 * e as ausências já registradas no aplicativo são mantidos, porque a planilha não os descreve.
 */
export function mergeImportedPatients(current: Patient[], imported: Patient[], mode: PatientImportMode): PatientMergeResult {
  const currentByCode = new Map(current.map(patient => [normalizeKey(patient.code), patient]));
  const importedCodes = new Set(imported.map(patient => normalizeKey(patient.code)));
  let updated = 0;
  const merged = new Map<string, Patient>();
  for (const patient of imported) {
    const previous = currentByCode.get(normalizeKey(patient.code));
    if (!previous) { merged.set(normalizeKey(patient.code), patient); continue; }
    updated++;
    const periods = [...(previous.unavailablePeriods ?? []), ...(patient.unavailablePeriods ?? [])]
      .filter((period, index, all) => all.findIndex(other => other.start === period.start && other.end === period.end) === index);
    merged.set(normalizeKey(patient.code), {
      ...patient, id: previous.id,
      ...(previous.transfer ? { transfer: previous.transfer } : {}),
      ...(previous.nextVisit && !patient.nextVisit ? { nextVisit: previous.nextVisit } : {}),
      ...(periods.length ? { unavailablePeriods: periods } : {})
    });
  }
  if (mode === 'replace') {
    return {
      patients: [...merged.values()], added: imported.length - updated, updated,
      removed: current.filter(patient => !importedCodes.has(normalizeKey(patient.code))).length
    };
  }
  // Os atualizados ficam na posição em que estavam; os novos entram no fim.
  const patients = [
    ...current.map(patient => merged.get(normalizeKey(patient.code)) ?? patient),
    ...imported.filter(patient => !currentByCode.has(normalizeKey(patient.code))).map(patient => merged.get(normalizeKey(patient.code))!)
  ];
  return { patients, added: imported.length - updated, updated, removed: 0 };
}

// --- Modelo ---

/** Linhas do modelo de planilha: cabeçalho e exemplos perto do posto informado. */
export function patientImportTemplate(center: Coordinates, startDate: string): TableCell[][] {
  const at = (dLat: number, dLng: number) => [Number((center.lat + dLat).toFixed(5)), Number((center.lng + dLng).toFixed(5))];
  const day = (offset: number) => {
    const date = new Date(`${startDate}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  };
  const header = PATIENT_IMPORT_COLUMNS.map(column => column.header);
  const row = (values: Record<string, TableCell>) => PATIENT_IMPORT_COLUMNS.map(column => values[column.key] ?? '');
  const [lat1, lng1] = at(0.002, -0.001);
  const [lat2, lng2] = at(-0.0015, 0.002);
  const [lat3, lng3] = at(0.001, 0.0025);
  return [
    header,
    row({ code: 'P001', lat: lat1, lng: lng1, condition: 'hipertensao', priority: 3, interval: 30, lastVisit: day(-25) }),
    row({ code: 'P002', lat: lat2, lng: lng2, duration: 50, buffer: 15, condition: 'curativo', priority: 5, interval: 7,
      hardDeadline: day(2), professions: 'tecnico_enfermagem:2; enfermagem', staff: 3 }),
    row({ code: 'P002', condition: 'diabetes', priority: 4, interval: 60, lastVisit: day(-40) }),
    row({ code: 'P003', lat: lat3, lng: lng3, condition: 'acamado', priority: 4, interval: 15, firstDue: day(5),
      awayStart: day(0), awayEnd: day(3), awayReason: 'Internação' })
  ];
}
