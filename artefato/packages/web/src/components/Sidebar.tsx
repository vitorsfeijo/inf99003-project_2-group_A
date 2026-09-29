import React, { useState } from 'react';
import { Plan, Scenario, VisitResult, DailyTeamRoute, PlannedVisit, Patient } from '@routing/core';
import { CheckCircle, XCircle, AlertTriangle, Users, Clock, Navigation } from 'lucide-react';

interface SidebarProps {
  scenario: Scenario | null;
  plan: Plan | null;
  selectedDate: string;
  onImportScenario: (scenario: Scenario) => void;
  onRegisterResults: (results: VisitResult[]) => void;
}

const TEAM_COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed'];

export const Sidebar: React.FC<SidebarProps> = ({
  scenario,
  plan,
  selectedDate,
  onImportScenario,
  onRegisterResults
}) => {
  const [activeTab, setActiveTab] = useState<'routes' | 'metrics' | 'execution'>('routes');
  const [executionState, setExecutionState] = useState<Record<string, { status: 'completed' | 'missed'; reason?: string }>>({});

  const dailyRoutes = plan ? plan.routes.filter(r => r.date === selectedDate) : [];

  // Tratar upload de JSON de cenário
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        onImportScenario(parsed);
      } catch (err) {
        alert('Erro ao ler o arquivo JSON do cenário.');
      }
    };
    reader.readAsText(file);
  };

  const handleStatusChange = (patientId: string, conditionId: string, status: 'completed' | 'missed') => {
    const key = `${patientId}_${conditionId}`;
    setExecutionState(prev => ({
      ...prev,
      [key]: { status, reason: prev[key]?.reason }
    }));
  };

  const handleReasonChange = (patientId: string, conditionId: string, reason: string) => {
    const key = `${patientId}_${conditionId}`;
    setExecutionState(prev => ({
      ...prev,
      [key]: { status: prev[key]?.status || 'missed', reason }
    }));
  };

  const handleSubmitExecution = () => {
    const results: VisitResult[] = [];
    Object.entries(executionState).forEach(([key, value]) => {
      const [patientId, conditionId] = key.split('_');
      results.push({
        patientId,
        conditionId,
        date: selectedDate,
        status: value.status,
        reason: value.reason
      });
    });

    if (results.length === 0) {
      alert('Marque o resultado de ao menos uma visita antes de salvar.');
      return;
    }

    onRegisterResults(results);
    setExecutionState({});
  };

  return (
    <aside style={{
      width: '380px',
      background: 'white',
      borderLeft: '1px solid #e2e8f0',
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 64px)'
    }}>
      {/* Abas */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
        <button
          onClick={() => setActiveTab('routes')}
          style={{ flex: 1, padding: '0.75rem', border: 'none', background: activeTab === 'routes' ? 'white' : 'transparent', fontWeight: 600, borderBottom: activeTab === 'routes' ? '2px solid #2563eb' : 'none', cursor: 'pointer' }}
        >
          Rotas
        </button>
        <button
          onClick={() => setActiveTab('metrics')}
          style={{ flex: 1, padding: '0.75rem', border: 'none', background: activeTab === 'metrics' ? 'white' : 'transparent', fontWeight: 600, borderBottom: activeTab === 'metrics' ? '2px solid #2563eb' : 'none', cursor: 'pointer' }}
        >
          Métricas
        </button>
        <button
          onClick={() => setActiveTab('execution')}
          style={{ flex: 1, padding: '0.75rem', border: 'none', background: activeTab === 'execution' ? 'white' : 'transparent', fontWeight: 600, borderBottom: activeTab === 'execution' ? '2px solid #2563eb' : 'none', cursor: 'pointer' }}
        >
          Execução
        </button>
      </div>

      {/* Conteúdo da Aba */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
        
        {/* Importar Cenário JSON no topo */}
        <div style={{ background: '#f1f5f9', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>CENÁRIO ATUAL</span>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{scenario ? scenario.healthCenter.name : 'Nenhum'}</span>
            <label style={{ background: '#2563eb', color: 'white', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}>
              Importar JSON
              <input type="file" accept=".json" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>
          </div>
        </div>

        {/* ABA 1: ROTAS DO DIA */}
        {activeTab === 'routes' && (
          <div>
            {!plan ? (
              <p style={{ color: '#64748b', textAlign: 'center', marginTop: '2rem' }}>Clique em <strong>"Gerar Rotas"</strong> para calcular a programação.</p>
            ) : dailyRoutes.length === 0 ? (
              <p style={{ color: '#64748b', textAlign: 'center', marginTop: '2rem' }}>Nenhuma rota agendada para o dia {selectedDate}.</p>
            ) : (
              dailyRoutes.map((route, rIdx) => {
                const color = TEAM_COLORS[rIdx % TEAM_COLORS.length];
                const team = scenario?.teams.find(t => t.id === route.teamId);

                return (
                  <div key={route.teamId} style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.75rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: color }} />
                        <strong style={{ fontSize: '0.95rem' }}>{team ? team.name : route.teamId}</strong>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{route.totalWorkTimeMinutes} min ({route.totalDistanceKm} km)</span>
                    </div>

                    {route.visits.length === 0 ? (
                      <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Sem visitas atribuídas para esta equipe hoje.</p>
                    ) : (
                      <ol style={{ paddingLeft: '1.25rem', fontSize: '0.85rem' }}>
                        {route.visits.map((v, idx) => {
                          const patient = scenario?.patients.find(p => p.id === v.patientId);
                          return (
                            <li key={idx} style={{ marginBottom: '0.5rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <strong>{patient ? patient.code : v.patientId}</strong>
                                <span style={{ color: '#2563eb', fontWeight: 600 }}>{v.estimatedStartTime} - {v.estimatedEndTime}</span>
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                Deslocamento: {v.travelDistanceKmFromPrevious} km ({v.travelTimeMinutesFromPrevious} min) | Duração: {v.durationMinutes} min
                              </div>
                            </li>
                          );
                        })}
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
                    <li key={u.visitCandidateId}>{u.patientId} ({u.conditionId}) - {u.reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ABA 2: MÉTRICAS */}
        {activeTab === 'metrics' && (
          <div>
            {!plan ? (
              <p style={{ color: '#64748b', textAlign: 'center', marginTop: '2rem' }}>Gere um plano para visualizar as métricas.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Cobertura</span>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#2563eb' }}>{plan.metrics.coveragePercentage}%</div>
                </div>
                <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Atraso Acumulado</span>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#dc2626' }}>{plan.metrics.totalOverdueDays} dias</div>
                </div>
                <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Deslocamento Total</span>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#059669' }}>{plan.metrics.totalTravelDistanceKm} km</div>
                </div>
                <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Utilização Média</span>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#d97706' }}>{plan.metrics.teamUtilizationPercentage}%</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ABA 3: REGISTRO DE EXECUÇÃO E REPLANEJAMENTO */}
        {activeTab === 'execution' && (
          <div>
            <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Registrar Atendimentos de Hoje ({selectedDate})</h4>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>
              Marque as visitas concluídas ou falhas para atualizar os prazos e acionar o replanejamento automático.
            </p>

            {dailyRoutes.flatMap((r: DailyTeamRoute) => r.visits).length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Não há visitas planejadas para este dia.</p>
            ) : (
              dailyRoutes.flatMap((r: DailyTeamRoute) => r.visits).map((visit: PlannedVisit) => {
                const key = `${visit.patientId}_${visit.conditionId}`;
                const patient = scenario?.patients.find((p: Patient) => p.id === visit.patientId);
                const currentStatus = executionState[key]?.status;

                return (
                  <div key={key} style={{ border: '1px solid #e2e8f0', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '0.75rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{patient ? patient.code : visit.patientId}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>Condição: {visit.conditionId}</div>

                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <button
                        onClick={() => handleStatusChange(visit.patientId, visit.conditionId, 'completed')}
                        style={{
                          flex: 1,
                          padding: '0.4rem',
                          border: '1px solid #059669',
                          background: currentStatus === 'completed' ? '#059669' : 'white',
                          color: currentStatus === 'completed' ? 'white' : '#059669',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        ✓ Concluída
                      </button>
                      <button
                        onClick={() => handleStatusChange(visit.patientId, visit.conditionId, 'missed')}
                        style={{
                          flex: 1,
                          padding: '0.4rem',
                          border: '1px solid #dc2626',
                          background: currentStatus === 'missed' ? '#dc2626' : 'white',
                          color: currentStatus === 'missed' ? 'white' : '#dc2626',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
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
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  background: '#059669',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  marginTop: '0.5rem'
                }}
              >
                Encerrar Dia e Replanejar
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
