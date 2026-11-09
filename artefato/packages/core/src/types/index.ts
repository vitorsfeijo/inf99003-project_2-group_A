/**
  Coordenadas geográficas (Latitude e Longitude)
 */
export interface Coordinates {
  lat: number;
  lng: number;
}

/**
  Posto de Saúde (unidade de origem/retorno das rotas)
 */
export interface HealthCenter {
  id: string;
  name: string;
  location: Coordinates;
}

/**
  Polígono que delimita uma região de atuação de saúde
 */
export interface TerritoryPolygon {
  id: string;
  name: string;
  vertices: Coordinates[];
  holes?: Coordinates[][];       // Recortes internos do território GeoSaúde
}

/**
  Condição de saúde acompanhada de um paciente
 */
export interface PatientCondition {
  conditionId: string;
  lastVisitDate?: string;      // YYYY-MM-DD da última visita efetivamente concluída
  initialDueDate?: string;     // YYYY-MM-DD explícito se nunca houve visita
  maxIntervalDays: number;     // Intervalo máximo em dias corridos entre visitas
  priorityWeight: number;      // Peso clínico (prioridade atribuída)
}

/**
  Categoria profissional que pode compor uma equipe e ser exigida por um paciente.
  Os identificadores do catálogo `PROFESSIONS` são os usados pela interface; outros
  textos são aceitos para permitir categorias locais.
 */
export type ProfessionId = string;

/**
  Transferência registrada por um profissional: o paciente passa a ser
  acompanhado por outra unidade e deixa de entrar no planejamento desta.
 */
export interface PatientTransfer {
  toRegionId: string;            // Território GeoSaúde de destino
  toHealthCenterName: string;
  date: string;                  // YYYY-MM-DD do registro
  reason?: string;
}

/**
  Paciente cadastrado no cenário
 */
export interface Patient {
  id: string;
  code: string;
  location: Coordinates;
  conditions: PatientCondition[];
  defaultVisitDurationMinutes: number; // Duração estimada do atendimento
  requiredProfessions?: ProfessionId[]; // Todas precisam estar na equipe que fizer a visita
  hardDeadline?: string;         // YYYY-MM-DD: prazo rígido, acima da prioridade (âncora = dia atual)
  assignedTeamId?: string;       // Vínculo: só esta equipe pode visitar o paciente
  territoryOverride?: 'include'; // Pertence à unidade mesmo fora do contorno GeoSaúde
  transfer?: PatientTransfer;    // Transferido para outra unidade: fora do planejamento
}

/**
  Equipe de visita (pode reunir várias categorias profissionais)
 */
export interface Team {
  id: string;
  name: string;
  doctorName?: string;
  nurseName?: string;
  socialWorkerName?: string;
  professions?: ProfessionId[];  // Categorias presentes na equipe que sai para as visitas
  dailyWorkMinutes: number;    // Minutos disponíveis para atendimento + deslocamento por dia
  availableDays: string[];     // Datas YYYY-MM-DD em que a equipe está disponível
}

/**
  Área marcada pela equipe como de risco: as rotas evitam atravessá-la.
 */
export interface RiskArea {
  id: string;
  name: string;
  vertices: Coordinates[];
  reason?: string;
}

/**
  Cenário completo de planejamento (Entrada)
 */
export interface Scenario {
  id: string;
  version: number;
  healthCenter: HealthCenter;
  polygons: TerritoryPolygon[];
  patients: Patient[];
  teams: Team[];
  startDate: string;              // YYYY-MM-DD inicial da janela de planejamento
  planningHorizonDays: number;   // N dias de trabalho na janela
  maxAnticipationDays: number;    // A dias de antecipação máxima permitida
  visitBufferMinutes?: number;    // Folga reservada após cada visita para imprevistos (padrão 0)
  deadlineSafetyMarginDays?: number; // Planejar cada visita estes dias antes do prazo (padrão 0)
  riskAreas?: RiskArea[];         // Áreas que as rotas devem evitar atravessar
}

/**
  Visita candidata gerada pelo motor de demanda para a janela de planejamento
 */
export interface VisitCandidate {
  id: string;
  patientId: string;
  conditionId: string;
  dueDate: string;               // YYYY-MM-DD data limite da visita
  targetDate: string;            // Prazo usado no planejamento: dueDate menos a margem de segurança
  priorityScore: number;         // Pontuação computada de urgência/peso
  durationMinutes: number;       // Atendimento + folga reservada
  bufferMinutes?: number;        // Parte de durationMinutes reservada como folga
  hardDeadline?: string;         // Prazo rígido efetivo (nunca anterior ao primeiro dia útil)
  requiredProfessions?: ProfessionId[];
  assignedTeamId?: string;
  isConditional: boolean;        // Se depende do cumprimento de uma visita anterior na mesma janela
  dependsOnVisitId?: string;
}

/**
  Matriz de Distância e Tempo entre todos os nós (Posto + Pacientes elegíveis)
 */
export interface CostMatrix {
  nodeIds: string[];             // Array de IDs (índice 0 é sempre o posto)
  distanceMatrix: number[][];    // Matriz de distância em KM
  timeMatrix: number[][];        // Matriz de tempo em minutos
}

/**
  Registro de uma visita alocada em uma rota
 */
export interface PlannedVisit {
  visitCandidateId: string;
  patientId: string;
  conditionId: string;
  durationMinutes?: number;      // Atendimento + folga reservada
  bufferMinutes?: number;        // Folga incluída em durationMinutes
  mandatory?: boolean;           // Visita com prazo rígido (âncora ou prazo máximo)
  estimatedStartTime: string;    // Horário estimado (ex: "08:30")
  estimatedEndTime: string;      // Horário estimado (ex: "09:15")
  travelTimeMinutesFromPrevious: number;
  travelDistanceKmFromPrevious: number;
}

/**
  Rota de uma equipe em um determinado dia de trabalho
 */
export interface DailyTeamRoute {
  date: string;                  // YYYY-MM-DD do dia do atendimento
  teamId: string;
  visits: PlannedVisit[];
  totalTravelTimeMinutes: number;
  totalVisitTimeMinutes: number;
  totalWorkTimeMinutes: number;  // Deslocamento + Atendimentos
  totalDistanceKm: number;
}

/**
  Visita pendente que não coube na jornada de nenhuma equipe
 */
export interface UnallocatedVisit {
  visitCandidateId: string;
  patientId: string;
  conditionId: string;
  reason: string;
  mandatory?: boolean;           // Prazo rígido que não pôde ser cumprido
}

/**
  Métricas quantitativas do plano gerado
 */
export interface PlanMetrics {
  coveragePercentage: number;           // % de visitas necessárias atendidas na janela
  onTimeCoveragePercentage: number;       // % da demanda atendida até o prazo
  priorityWeightedCoveragePercentage: number; // Cobertura ponderada pelo peso clínico, independente de prazo
  priorityWeightedOnTimeCoveragePercentage: number; // Cobertura pontual ponderada pelo peso clínico (1-5)
  priorityWeightedPromptCoveragePercentage: number; // Vencidas no primeiro dia ou demais até o prazo, ponderadas
  priorityWeightedAverageDelayDays: number; // Atraso médio ponderado pelo peso clínico; pendências censuradas no último dia
  priorityWeightedActionableDelayDays: number; // Atraso adicional após início da janela, ponderado
  p90AllocatedDelayDays: number;          // Percentil 90 do atraso das visitas alocadas
  delayBuckets: { onTime: number; oneToTwoDays: number; threeToSevenDays: number; overSevenDays: number; unallocated: number };
  distancePerAllocatedVisitKm: number;    // Inclui o retorno ao posto
  travelTimePerAllocatedVisitMinutes: number;
  timelyPriorityPointsPerKm: number;      // Soma de pesos clínicos atendidos no prazo / km
  priorityPointsPerKm: number;            // Soma de pesos clínicos alocados / km
  totalOverdueDays: number;             // Soma dos dias de atraso acumulados
  totalTravelDistanceKm: number;        // Distância total percorrida por todas as equipes (km)
  totalTravelTimeMinutes: number;       // Tempo total de deslocamento (min)
  teamUtilizationPercentage: number;    // % média da jornada utilizada pelas equipes
  teamWorkloadImbalance: number;        // Desvio padrão / variação entre cargas das equipes
  mandatoryVisitCount?: number;         // Visitas com prazo rígido (presente só quando houver)
  mandatoryVisitsMetCount?: number;     // Das anteriores, alocadas até o prazo rígido
}

/**
  Plano de Rotas Gerado (Saída)
 */
export interface Plan {
  id: string;
  scenarioId: string;
  scenarioVersion: number;
  strategyId: string;
  generatedAt: string;                  // ISO Timestamp
  routes: DailyTeamRoute[];
  unallocatedVisits: UnallocatedVisit[];
  metrics: PlanMetrics;
  warnings?: string[];                  // Restrições que não puderam ser atendidas (ex.: prazo rígido)
}

/**
  Resultado real informado para uma visita executada no dia
 */
export interface VisitResult {
  patientId: string;
  conditionId: string;
  date: string;                         // YYYY-MM-DD em que a tentativa ocorreu
  status: 'completed' | 'missed';       // Concluída ou Não Realizada
  reason?: string;
}

/**
  Opções de execução do planejamento
 */
export interface PlanOptions {
  strategyId: string;                   // 'urgency-baseline' | 'nearest-baseline' | 'main-heuristic'
  enable1_5Opt?: boolean;               // Padrão: true (Otimização local 1.5-opt)
  enable2Opt?: boolean;                 // Suporte legado
  costMatrix: CostMatrix;               // Matriz viária pré-calculada, na ordem posto + pacientes elegíveis
}

/**
  Resultado do verificador formal de restrições
 */
export interface VerificationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
  Estado atual do cenário e histórico de execuções reais
 */
export interface ScenarioState {
  scenario: Scenario;
  history: VisitResult[];
  currentDate: string;
}

/**
  Contexto de planejamento repassado para as estratégias de roteamento
 */
export interface PlanningContext {
  scenario: Scenario;
  costMatrix: CostMatrix;
  candidates: VisitCandidate[];
  workingDays: string[];
}

/**
  Interface padrão para implementação de estratégias de roteamento
 */
export interface RoutingStrategy {
  id: string;
  name: string;
  description: string;
  solve(context: PlanningContext): {
    routes: DailyTeamRoute[];
    unallocatedVisits: UnallocatedVisit[];
  };
}
