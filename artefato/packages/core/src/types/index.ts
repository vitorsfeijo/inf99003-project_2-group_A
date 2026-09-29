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
  Paciente cadastrado no cenário
 */
export interface Patient {
  id: string;
  code: string;
  location: Coordinates;
  conditions: PatientCondition[];
  defaultVisitDurationMinutes: number; // Duração estimada do atendimento
}

/**
  Equipe multiprofissional (Médico, Enfermeiro e Assistente Social)
 */
export interface Team {
  id: string;
  name: string;
  doctorName?: string;
  nurseName?: string;
  socialWorkerName?: string;
  dailyWorkMinutes: number;    // Minutos disponíveis para atendimento + deslocamento por dia
  availableDays: string[];     // Datas YYYY-MM-DD em que a equipe está disponível
}

/**
  Parâmetros de cálculo de custo e velocidade
 */
export interface CostParameters {
  travelSpeedKmh: number;      // Velocidade média para conversão de distância em tempo (ex: 20 km/h)
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
  costParameters: CostParameters;
}

/**
  Visita candidata gerada pelo motor de demanda para a janela de planejamento
 */
export interface VisitCandidate {
  id: string;
  patientId: string;
  conditionId: string;
  dueDate: string;               // YYYY-MM-DD data limite da visita
  priorityScore: number;         // Pontuação computada de urgência/peso
  durationMinutes: number;
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
  durationMinutes?: number;
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
}

/**
  Métricas quantitativas do plano gerado
 */
export interface PlanMetrics {
  coveragePercentage: number;           // % de visitas necessárias atendidas na janela
  totalOverdueDays: number;             // Soma dos dias de atraso acumulados
  totalTravelDistanceKm: number;        // Distância total percorrida por todas as equipes (km)
  totalTravelTimeMinutes: number;       // Tempo total de deslocamento (min)
  teamUtilizationPercentage: number;    // % média da jornada utilizada pelas equipes
  teamWorkloadImbalance: number;        // Desvio padrão / variação entre cargas das equipes
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
