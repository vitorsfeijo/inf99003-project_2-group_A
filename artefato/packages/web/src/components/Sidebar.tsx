import React, { useEffect, useState } from 'react';
import { Plan, Scenario, VisitResult, DailyTeamRoute, PlannedVisit, Patient, professionLabel, teamProfessions } from '@routing/core';
import { AlertTriangle } from 'lucide-react';
import { PatientPanel } from './PatientPanel';
import { BaseRegionSummary } from '../services/api';
import { badge } from './styles';

export type SidebarTab = 'routes' | 'patients' | 'metrics' | 'execution';

interface SidebarProps {
  scenario: Scenario | null;
  plan: Plan | null;
  selectedDate: string;
  activeTab: SidebarTab;
  onChangeTab: (tab: SidebarTab) => void;
  onRegisterResults: (results: VisitResult[]) => Promise<boolean>;
  patientPanel: Omit<React.ComponentProps<typeof PatientPanel>, 'scenario' | 'regions'> & { regions: BaseRegionSummary[] };
}

const TEAM_COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed'];
const TABS: { id: SidebarTab; label: string }[] = [
  { id: 'routes', label: 'Rotas' }, { id: 'patients', label: 'Pacientes' },
  { id: 'metrics', label: 'Métricas' }, { id: 'execution', label: 'Execução' }
];

export const Sidebar: React.FC<SidebarProps> = ({
  scenario,
  plan,
  selectedDate,
  activeTab,
  onChangeTab,
  onRegisterResults,
  patientPanel
}) => {
  const [executionState, setExecutionState] = useState<Record<string, { status: 'completed' | 'missed'; reason?: string }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dailyRoutes = plan ? plan.routes.filter(r => r.date === selectedDate) : [];
  const patientCode = (patientId: string) => scenario?.patients.find(patient => patient.id === patientId)?.code ?? patientId;

  useEffect(() => setExecutionState({}), [scenario?.id, scenario?.version, plan?.id, selectedDate]);

  const handleStatusChange = (patientId: string, conditionId: string, status: 'completed' | 'missed') => {
    const key = JSON.stringify([patientId, conditionId]);
    setExecutionState(prev => ({
      ...prev,
      [key]: { status, reason: prev[key]?.reason }
    }));
  };

  const handleReasonChange = (patientId: string, conditionId: string, reason: string) => {
    const key = JSON.stringify([patientId, conditionId]);
    setExecutionState(prev => ({
      ...prev,
      [key]: { status: prev[key]?.status || 'missed', reason }
    }));
  };

  const handleSubmitExecution = async () => {
    if (isSubmitting) return;
    const results: VisitResult[] = [];
    const visits = dailyRoutes.flatMap(route => route.visits);
    if (visits.some(visit => !executionState[JSON.stringify([visit.patientId, visit.conditionId])])) {
      alert('Marque cada visita planejada como concluída ou não realizada.');
      return;
    }
    visits.forEach(visit => {
      const value = executionState[JSON.stringify([visit.patientId, visit.conditionId])];
      results.push({ patientId: visit.patientId, conditionId: visit.conditionId, date: selectedDate, status: value.status, reason: value.reason });
    });

    if (results.length === 0) {
      alert('Marque o resultado de ao menos uma visita antes de salvar.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (await onRegisterResults(results)) setExecutionState({});
    } finally {
      setIsSubmitting(false);
    }
  };

  const metricCard = (title: string, value: string, color: string) => (
    <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{title}</span>
      <div style={{ fontSize: '1.2rem', fontWeight: 700, color }}>{value}</div>
    </div>
  );

  return (
    <div style={{
      width: '100%',
      background: 'white',
      borderLeft: '1px solid #e2e8f0',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      flex: 1,
      position: 'relative',
      zIndex: 1,
      flexShrink: 0
    }}>
      {/* Abas */}
      <div role="tablist" style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
        {TABS.map(tab => (
          <button key={tab.id} role="tab" aria-selected={activeTab === tab.id} onClick={() => onChangeTab(tab.id)}
            style={{ flex: 1, padding: '0.75rem 0.25rem', border: 'none', background: activeTab === tab.id ? 'white' : 'transparent', fontWeight: 600, fontSize: '0.85rem', borderBottom: activeTab === tab.id ? '2px solid #2563eb' : 'none', cursor: 'pointer' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Conteúdo da Aba */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>

        {/* ABA 1: ROTAS DO DIA */}
        {activeTab === 'routes' && (
          <div>
            {plan?.warnings?.length ? (
              <div role="alert" style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: '0.5rem', padding: '0.6rem 0.75rem', marginBottom: '0.75rem', fontSize: '0.8rem', color: '#9a3412' }}>
                <strong>Restrições não atendidas</strong>
                <ul style={{ paddingLeft: '1rem', marginTop: 4 }}>{plan.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
              </div>
            ) : null}
            {!plan ? (
              <p style={{ color: '#64748b', textAlign: 'center', marginTop: '2rem' }}>Conclua as etapas acima para ver o cronograma.</p>
            ) : dailyRoutes.length === 0 ? (
              <p style={{ color: '#64748b', textAlign: 'center', marginTop: '2rem' }}>Nenhuma rota agendada para o dia {selectedDate}.</p>
            ) : (
              dailyRoutes.map(route => {
                const color = TEAM_COLORS[Math.max(0, scenario?.teams.findIndex(t => t.id === route.teamId) ?? 0) % TEAM_COLORS.length];
                const team = scenario?.teams.find(t => t.id === route.teamId);

                return (
                  <div key={route.teamId} style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.75rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: color }} />
                        <strong style={{ fontSize: '0.95rem' }}>{team ? team.name : route.teamId}</strong>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{route.totalWorkTimeMinutes} min ({route.totalDistanceKm} km)</span>
                    </div>
                    {team && <p style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.5rem' }}>{teamProfessions(team).map(professionLabel).join(' · ') || 'Sem categorias cadastradas'}</p>}

                    {route.visits.length === 0 ? (
                      <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Sem visitas atribuídas para esta equipe hoje.</p>
                    ) : (
                      <ol style={{ paddingLeft: '1.25rem', fontSize: '0.85rem' }}>
                        {route.visits.map((v, idx) => (
                          <li key={idx} style={{ marginBottom: '0.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                              <span>
                                <strong>{patientCode(v.patientId)}</strong>
                                {v.mandatory && <span title="Prazo rígido (âncora ou prazo máximo)" style={{ ...badge('#9a3412', '#ffedd5'), marginLeft: 6 }}>⚓ obrigatória</span>}
                              </span>
                              <span style={{ color: '#2563eb', fontWeight: 600 }}>{v.estimatedStartTime} - {v.estimatedEndTime}</span>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              Deslocamento: {v.travelDistanceKmFromPrevious} km ({v.travelTimeMinutesFromPrevious} min) | Duração: {(v.durationMinutes ?? 0) - (v.bufferMinutes ?? 0)} min{v.bufferMinutes ? ` + ${v.bufferMinutes} min de folga` : ''}
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                );
              })
            )}

            {/* Fila de não alocados */}
            {plan && plan.unallocatedVisits.length > 0 && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem', padding: '0.75rem', marginTop: '1rem' }}>
                <strong style={{ color: '#991b1b', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <AlertTriangle size={14} /> Fila de Não Alocados ({plan.unallocatedVisits.length})
                </strong>
                <ul style={{ paddingLeft: '1rem', fontSize: '0.8rem', color: '#7f1d1d', marginTop: '0.25rem' }}>
                  {plan.unallocatedVisits.map(u => (
                    <li key={u.visitCandidateId} style={{ fontWeight: u.mandatory ? 700 : 400 }}>{u.mandatory ? '⚓ ' : ''}{patientCode(u.patientId)} — {u.reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ABA 2: CADASTRO DE PACIENTES */}
        {activeTab === 'patients' && <PatientPanel scenario={scenario} {...patientPanel} />}

        {/* ABA 3: MÉTRICAS */}
        {activeTab === 'metrics' && (
          <div>
            {!plan ? (
              <p style={{ color: '#64748b', textAlign: 'center', marginTop: '2rem' }}>Gere um plano para visualizar as métricas.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {plan.metrics.mandatoryVisitCount !== undefined && metricCard('Prazos rígidos cumpridos',
                  `${plan.metrics.mandatoryVisitsMetCount} de ${plan.metrics.mandatoryVisitCount}`,
                  plan.metrics.mandatoryVisitsMetCount === plan.metrics.mandatoryVisitCount ? '#059669' : '#dc2626')}
                {metricCard('Cobertura', `${plan.metrics.coveragePercentage}%`, '#2563eb')}
                {metricCard('Cobertura da prioridade clínica', `${plan.metrics.priorityWeightedCoveragePercentage}%`, '#2563eb')}
                {metricCard('No prazo · prioridade ponderada', `${plan.metrics.priorityWeightedOnTimeCoveragePercentage}%`, '#2563eb')}
                {metricCard('Prioridade atendida a tempo', `${plan.metrics.priorityWeightedPromptCoveragePercentage}%`, '#2563eb')}
                {metricCard('Atraso controlável ponderado', `${plan.metrics.priorityWeightedActionableDelayDays} dias`, '#dc2626')}
                {metricCard('Atraso Acumulado', `${plan.metrics.totalOverdueDays} dias`, '#dc2626')}
                {metricCard('Deslocamento Total', `${plan.metrics.totalTravelDistanceKm} km`, '#059669')}
                {metricCard('Custo por visita alocada', `${plan.metrics.distancePerAllocatedVisitKm} km · ${plan.metrics.travelTimePerAllocatedVisitMinutes} min`, '#059669')}
                {metricCard('Atraso P90 das alocadas', `${plan.metrics.p90AllocatedDelayDays} dias`, '#dc2626')}
                {metricCard('Utilização Média', `${plan.metrics.teamUtilizationPercentage}%`, '#d97706')}
              </div>
            )}
          </div>
        )}

        {/* ABA 4: REGISTRO DE EXECUÇÃO E REPLANEJAMENTO */}
        {activeTab === 'execution' && (
          <div>
            <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Registrar Atendimentos de Hoje ({selectedDate})</h4>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>
              Marque as visitas concluídas ou não realizadas. Ao encerrar o dia, os prazos são atualizados e a agenda é refeita a partir do próximo dia útil; uma visita não realizada mantém o prazo original.
            </p>

            {dailyRoutes.flatMap((r: DailyTeamRoute) => r.visits).length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Não há visitas planejadas para este dia.</p>
            ) : (
              dailyRoutes.flatMap((r: DailyTeamRoute) => r.visits).map((visit: PlannedVisit) => {
                const key = JSON.stringify([visit.patientId, visit.conditionId]);
                const patient = scenario?.patients.find((p: Patient) => p.id === visit.patientId);
                const currentStatus = executionState[key]?.status;

                return (
                  <div key={key} style={{ border: '1px solid #e2e8f0', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '0.75rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{patient ? patient.code : visit.patientId}{visit.mandatory ? ' ⚓' : ''}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>Condição: {visit.conditionId}</div>

                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <button
                        onClick={() => handleStatusChange(visit.patientId, visit.conditionId, 'completed')}
                        style={{ flex: 1, padding: '0.4rem', minHeight: 40, border: '1px solid #059669', background: currentStatus === 'completed' ? '#059669' : 'white', color: currentStatus === 'completed' ? 'white' : '#059669', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                      >
                        ✓ Concluída
                      </button>
                      <button
                        onClick={() => handleStatusChange(visit.patientId, visit.conditionId, 'missed')}
                        style={{ flex: 1, padding: '0.4rem', minHeight: 40, border: '1px solid #dc2626', background: currentStatus === 'missed' ? '#dc2626' : 'white', color: currentStatus === 'missed' ? 'white' : '#dc2626', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                      >
                        ✕ Não Realizada
                      </button>
                    </div>

                    {currentStatus === 'missed' && (
                      <input
                        type="text"
                        placeholder="Motivo (ex: ausente, recusou)"
                        value={executionState[key]?.reason || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleReasonChange(visit.patientId, visit.conditionId, e.target.value)}
                        style={{ width: '100%', padding: '0.4rem', fontSize: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '0.25rem' }}
                      />
                    )}
                  </div>
                );
              })
            )}

            {dailyRoutes.flatMap((r: DailyTeamRoute) => r.visits).length > 0 && (
              <button
                onClick={handleSubmitExecution}
                disabled={isSubmitting}
                style={{ width: '100%', padding: '0.65rem', background: '#059669', color: 'white', border: 'none', borderRadius: '0.375rem', fontWeight: 600, fontSize: '0.9rem', cursor: isSubmitting ? 'wait' : 'pointer', marginTop: '0.5rem' }}
              >
                {isSubmitting ? 'Registrando...' : 'Encerrar Dia e Replanejar'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
