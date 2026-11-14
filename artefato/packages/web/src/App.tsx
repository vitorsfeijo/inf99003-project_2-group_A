import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Scenario, Plan, VisitResult, Patient, Team, Coordinates, sampleTerritoryPatients, countWorkingDaysInNextMonth, isPointInAnyPolygon } from '@routing/core';
import { Header } from './components/Header';
import { Sidebar, SidebarTab } from './components/Sidebar';
import { MapMode, MapView } from './components/MapView';
import { WorkflowPanel } from './components/WorkflowPanel';
import { ComparisonView } from './components/ComparisonView';
import { StatisticsView } from './components/StatisticsView';
import { BaseRegionSummary, RoutingStatus, SavedDraft, createTransfer, discardDraft, fetchBaseRegion, fetchBaseRegions, fetchIncomingPatients,
  fetchLatestDraft, fetchRoutingStatus, generateComparison, registerVisitResults, removeVisitFromRoute, saveDraft, saveScenario } from './services/api';

const STALE_PLAN_NOTICE = 'O cenário mudou: gere os planos novamente para aplicar as alterações.';
const AUTOSAVE_DELAY_MS = 600;

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dateTimeOf = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export const App: React.FC = () => {
  const [baseScenario, setBaseScenario] = useState<Scenario | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [comparisonPlans, setComparisonPlans] = useState<Plan[]>([]);
  const [activeView, setActiveView] = useState<'routes' | 'comparison' | 'statistics'>('routes');
  const [resumeOffer, setResumeOffer] = useState<SavedDraft | null>(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedStrategy, setSelectedStrategy] = useState('main-heuristic');
  const [isGenerating, setIsGenerating] = useState(false);
  const [regions, setRegions] = useState<BaseRegionSummary[]>([]);
  const [regionsError, setRegionsError] = useState('');
  const [isLoadingRegions, setIsLoadingRegions] = useState(true);
  const [isLoadingRegion, setIsLoadingRegion] = useState(false);
  const [routingStatus, setRoutingStatus] = useState<RoutingStatus>({ walkingNetworkConfigured: false });
  const [planningError, setPlanningError] = useState('');
  const [staleNotice, setStaleNotice] = useState('');
  const [sampleNotice, setSampleNotice] = useState('');
  const [mapMode, setMapMode] = useState<MapMode>('view');
  const [draftRiskPoints, setDraftRiskPoints] = useState<Coordinates[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('routes');
  const selectionRequest = useRef(0);

  useEffect(() => {
    void refreshRegions();
    void refreshRoutingStatus();
    // Edições salvas numa sessão anterior: o usuário escolhe retomar ou descartar.
    fetchLatestDraft()
      .then(draft => setResumeOffer(draft))
      .catch(error => setSaveStatus(`Não foi possível consultar as edições salvas: ${error instanceof Error ? error.message : String(error)}`));
  }, []);

  // Cada alteração do cenário de trabalho é guardada no servidor, para que recarregar a página não a perca.
  useEffect(() => {
    if (!scenario || !baseScenario) return;
    const timer = setTimeout(() => {
      saveDraft(baseScenario.id, { scenario, strategyId: selectedStrategy, selectedDate })
        .then(result => setSaveStatus(`salvo no servidor às ${timeOf(result.savedAt)}`))
        .catch(error => setSaveStatus(`edições NÃO salvas: ${error instanceof Error ? error.message : String(error)}`));
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [scenario, baseScenario, selectedStrategy, selectedDate]);

  const handleResume = async (draft: SavedDraft) => {
    const requestId = ++selectionRequest.current;
    setIsLoadingRegion(true);
    try {
      const loaded = await fetchBaseRegion(draft.regionId);
      if (selectionRequest.current !== requestId) return;
      const strategy = draft.strategyId ?? 'main-heuristic';
      setBaseScenario(loaded);
      setScenario(draft.scenario);
      setComparisonPlans(draft.plans);
      setSelectedStrategy(strategy);
      setPlan(draft.plans.find(item => item.strategyId === strategy) ?? draft.plans[0] ?? null);
      setSelectedDate(draft.selectedDate ?? draft.scenario.startDate);
      setStaleNotice(draft.plans.length ? '' : 'Edições retomadas. Gere os planos para ver as rotas.');
      setResumeOffer(null);
      setActiveView('routes');
    } catch (error) {
      setRegionsError(`Não foi possível retomar as edições: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (selectionRequest.current === requestId) setIsLoadingRegion(false);
    }
  };

  const handleDiscardDraft = async (draft: SavedDraft) => {
    if (!window.confirm(`Descartar as edições salvas de ${draft.scenario.healthCenter.name}? Isso não pode ser desfeito.`)) return;
    try {
      await discardDraft(draft.regionId);
      setResumeOffer(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    }
  };

  const refreshRegions = async () => {
    setIsLoadingRegions(true);
    setRegionsError('');
    try {
      setRegions(await fetchBaseRegions());
    } catch (error) {
      setRegionsError(error instanceof TypeError
        ? 'API indisponível na porta 3001. Inicie o aplicativo (npm start) e tente novamente.'
        : error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoadingRegions(false);
    }
  };

  const refreshRoutingStatus = async () => {
    try {
      setRoutingStatus(await fetchRoutingStatus());
    } catch (error) {
      setRoutingStatus({ walkingNetworkConfigured: false, detail: error instanceof Error ? error.message : String(error) });
    }
  };

  const resetPlans = () => {
    setPlan(null);
    setComparisonPlans([]);
    setActiveView('routes');
    setPlanningError('');
  };

  /** Toda edição gera uma nova versão do cenário; planos anteriores deixam de valer. */
  const editScenario = (update: (current: Scenario) => Scenario) => {
    setScenario(current => current ? { ...update(current), version: current.version + 1 } : current);
    if (plan || comparisonPlans.length) {
      resetPlans();
      setStaleNotice(STALE_PLAN_NOTICE);
    }
  };

  const handleSelectRegion = async (id: string) => {
    const requestId = ++selectionRequest.current;
    setBaseScenario(null);
    setScenario(null);
    resetPlans();
    setSelectedDate('');
    setRegionsError('');
    setSampleNotice('');
    setStaleNotice('');
    setSelectedPatientId(null);
    setMapMode('view');
    setDraftRiskPoints([]);
    setIsLoadingRegion(Boolean(id));
    if (!id) return;
    try {
      const loaded = await fetchBaseRegion(id);
      if (selectionRequest.current !== requestId) return;
      setBaseScenario(loaded);
      setSelectedDate(loaded.startDate);
    } catch (error) {
      if (selectionRequest.current === requestId) setRegionsError(error instanceof Error ? error.message : String(error));
    } finally {
      if (selectionRequest.current === requestId) setIsLoadingRegion(false);
    }
  };

  const handleSample = async (count: number, seed: number) => {
    if (!baseScenario) return;
    let sampled: Scenario;
    try {
      const monthlyBase = { ...baseScenario, planningHorizonDays: countWorkingDaysInNextMonth(baseScenario.startDate) };
      sampled = sampleTerritoryPatients(monthlyBase, count, seed);
    } catch (error) {
      alert(`Erro na amostragem: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    resetPlans();
    setStaleNotice('');
    setResumeOffer(null);
    setSelectedPatientId(null);
    setSelectedDate(sampled.startDate);
    // Pacientes que outras unidades transferiram para este território entram na amostra.
    try {
      const incoming = await fetchIncomingPatients(baseScenario.id);
      setScenario({ ...sampled, patients: [...sampled.patients, ...incoming.map(item => item.patient)] });
      setSampleNotice(incoming.length
        ? `${incoming.length} paciente(s) recebido(s) por transferência: ${incoming.map(item => `${item.patient.code} (de ${item.fromHealthCenterName})`).join(', ')}.`
        : '');
    } catch (error) {
      setScenario(sampled);
      setSampleNotice(`Não foi possível consultar transferências recebidas: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleGeneratePlan = async () => {
    if (!scenario || isGenerating || !routingStatus.walkingNetworkConfigured) return;
    setIsGenerating(true);
    setPlan(null);
    setPlanningError('');
    setMapMode('view');
    try {
      await saveScenario(scenario);
      const plans = await generateComparison(scenario.id, scenario.version);
      const newPlan = plans.find(item => item.strategyId === selectedStrategy) ?? plans[0];
      if (!newPlan) throw new Error('Nenhum plano foi retornado.');
      setComparisonPlans(plans);
      setPlan(newPlan);
      setStaleNotice('');
      setActiveView('routes');
      setSidebarTab('routes');
      if (newPlan.routes.length > 0) setSelectedDate(newPlan.routes[0].date);
    } catch (error) {
      if (error instanceof TypeError) {
        setPlanningError('A API parou de responder durante o cálculo. Verifique o aplicativo na porta 3001 e tente novamente.');
        setRoutingStatus({ walkingNetworkConfigured: false });
      } else {
        setPlanningError(`Erro ao gerar cronograma: ${error instanceof Error ? error.message : String(error)}`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegisterResults = async (results: VisitResult[]) => {
    if (!scenario) return false;
    try {
      const response = await registerVisitResults(
        scenario.id, results, selectedDate,
        { strategyId: selectedStrategy, enable1_5Opt: true }, scenario.version
      );
      // O servidor devolve o cenário atualizado (prazos, âncoras cumpridas e janela a partir do próximo dia útil).
      setScenario(response.scenario);
      setPlan(response.plan);
      setComparisonPlans([]);
      setActiveView('routes');
      setSidebarTab('routes');
      setSelectedDate(response.plan.routes[0]?.date ?? response.scenario.startDate);
      alert(`Resultados registrados. Nova agenda a partir de ${response.scenario.startDate}.`);
      return true;
    } catch (error) {
      alert(`Erro ao registrar resultados via servidor: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  };

  /** Retira um paciente da rota do dia: "só pular" mantém a ordem dos demais; "recalcular" refaz o plano. */
  const handleRemoveVisit = async (removal: { date: string; teamId: string; patientId: string; reason?: string; mode: 'skip' | 'replan' }) => {
    if (!plan) return false;
    try {
      const response = await removeVisitFromRoute(plan.id, removal);
      setScenario(response.scenario);
      setPlan(response.plan);
      // Os planos das outras estratégias eram da versão anterior do cenário.
      setComparisonPlans([response.plan]);
      setStaleNotice('');
      return true;
    } catch (error) {
      alert(`Erro ao retirar a visita: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  };

  // --- Edição de pacientes ---
  const updatePatient = (patientId: string, update: (patient: Patient) => Patient) =>
    editScenario(current => ({ ...current, patients: current.patients.map(patient => patient.id === patientId ? update(patient) : patient) }));
  const handleUpdatePatient = (patientId: string, patch: Partial<Patient> | ((patient: Patient) => Partial<Patient>)) =>
    updatePatient(patientId, patient => ({ ...patient, ...(typeof patch === 'function' ? patch(patient) : patch) }));
  const handleClearPatientFields = (patientId: string, fields: (keyof Patient)[]) => updatePatient(patientId, patient => {
    const copy = { ...patient };
    for (const field of fields) delete copy[field];
    return copy;
  });
  const handleRemovePatient = (patientId: string) => {
    editScenario(current => ({ ...current, patients: current.patients.filter(patient => patient.id !== patientId) }));
    setSelectedPatientId(null);
  };
  const handleTransferPatient = async (patientId: string, toRegionId: string, reason: string) => {
    if (!scenario || !baseScenario) return;
    const patient = scenario.patients.find(item => item.id === patientId);
    const region = regions.find(item => item.id === toRegionId);
    if (!patient || !region) return;
    try {
      await createTransfer({ fromScenarioId: scenario.id, fromRegionId: baseScenario.id, fromHealthCenterName: scenario.healthCenter.name,
        toRegionId, patient, reason: reason || undefined });
      handleUpdatePatient(patientId, { transfer: { toRegionId, toHealthCenterName: region.healthCenterName || region.name,
        date: scenario.startDate, ...(reason ? { reason } : {}) } });
    } catch (error) {
      alert(`Erro ao transferir: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleSelectPatient = (patientId: string | null) => {
    setSelectedPatientId(patientId);
    if (patientId) setSidebarTab('patients');
  };

  // --- Mapa: desenhar áreas de risco e cadastrar pacientes ---
  const handleMapClick = (point: Coordinates) => {
    if (mapMode === 'draw-risk') {
      setDraftRiskPoints(points => [...points, point]);
      return;
    }
    if (mapMode !== 'add-patient' || !scenario) return;
    const number = scenario.patients.filter(patient => patient.id.startsWith('manual_')).length + 1;
    const patient: Patient = {
      id: `manual_${Date.now().toString(36)}`, code: `M${String(number).padStart(3, '0')}`, location: point,
      defaultVisitDurationMinutes: 30,
      conditions: [{ conditionId: 'cond_principal', initialDueDate: scenario.startDate, maxIntervalDays: 30, priorityWeight: 3 }],
      // Um cadastro manual é intencional: pertence à unidade mesmo se cair fora do contorno.
      ...(isPointInAnyPolygon(point, scenario.polygons) ? {} : { territoryOverride: 'include' as const })
    };
    editScenario(current => ({ ...current, patients: [...current.patients, patient] }));
    setMapMode('view');
    handleSelectPatient(patient.id);
  };
  const handleFinishRisk = (name: string, reason: string) => {
    if (draftRiskPoints.length < 3) return;
    const area = { id: `risco_${Date.now().toString(36)}`, name, vertices: draftRiskPoints, ...(reason ? { reason } : {}) };
    editScenario(current => ({ ...current, riskAreas: [...(current.riskAreas ?? []), area] }));
    setDraftRiskPoints([]);
    setMapMode('view');
  };
  const handleChangeTeams = (updateTeams: (teams: Team[]) => Team[]) => editScenario(current => {
    const teams = updateTeams(current.teams);
    const teamIds = new Set(teams.map(team => team.id));
    return { ...current, teams, patients: current.patients.map(patient => {
      if (!patient.assignedTeamId || teamIds.has(patient.assignedTeamId)) return patient;
      const { assignedTeamId: _removed, ...rest } = patient;
      return rest;
    }) };
  });

  const mapScenario = useMemo(() => scenario ?? (baseScenario ? { ...baseScenario, patients: [] } : null), [scenario, baseScenario]);
  const handleSelectStrategy = (strategy: string) => {
    setSelectedStrategy(strategy);
    setPlan(comparisonPlans.find(item => item.strategyId === strategy) ?? null);
    setPlanningError('');
  };
  const handleOpenPlan = (strategyId: string, date?: string) => {
    handleSelectStrategy(strategyId);
    const selectedPlan = comparisonPlans.find(item => item.strategyId === strategyId);
    setSelectedDate(date ?? selectedPlan?.routes[0]?.date ?? scenario?.startDate ?? '');
    setActiveView('routes');
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header scenario={scenario ?? baseScenario} plan={plan} selectedDate={selectedDate} setSelectedDate={setSelectedDate}
        showRouteControls={activeView === 'routes'} canExport saveStatus={scenario ? saveStatus : ''} />
      <nav className="view-tabs" aria-label="Telas do planejamento"><button type="button" aria-current={activeView === 'routes' ? 'page' : undefined} onClick={() => setActiveView('routes')}>Mapa e rotas</button><button type="button" disabled={!comparisonPlans.length} aria-current={activeView === 'comparison' ? 'page' : undefined} onClick={() => setActiveView('comparison')}>Comparar planos {comparisonPlans.length ? `(${comparisonPlans.length})` : ''}</button><button type="button" aria-current={activeView === 'statistics' ? 'page' : undefined} onClick={() => setActiveView('statistics')}>Estatísticas de uso</button></nav>
      {resumeOffer && !scenario && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 20px', background: '#eff6ff', borderBottom: '1px solid #bfdbfe', fontSize: 13, color: '#1e3a8a' }}>
          <span style={{ flex: 1, minWidth: 240 }}>
            Há edições salvas de <strong>{resumeOffer.scenario.healthCenter.name}</strong>: {resumeOffer.scenario.patients.length} pacientes,
            {' '}{resumeOffer.scenario.teams.length} equipe(s){resumeOffer.plans.length ? ' e planos já gerados' : ''}, salvas em {dateTimeOf(resumeOffer.updatedAt)}.
          </span>
          <button type="button" onClick={() => void handleResume(resumeOffer)} style={{ minHeight: 36, padding: '0 14px', border: 'none', borderRadius: 8, background: '#2563eb', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Retomar de onde parei</button>
          <button type="button" onClick={() => void handleDiscardDraft(resumeOffer)} style={{ minHeight: 36, padding: '0 10px', border: 'none', background: 'transparent', color: '#b91c1c', fontWeight: 700, cursor: 'pointer' }}>Descartar</button>
        </div>
      )}
      {activeView === 'statistics' ?
        <StatisticsView regions={regions} regionId={baseScenario?.id ?? resumeOffer?.regionId ?? ''} refreshKey={`${scenario?.id}-${scenario?.version}`} /> :
      activeView === 'comparison' && scenario && comparisonPlans.length ?
        <ComparisonView scenario={scenario} plans={comparisonPlans} onOpenPlan={handleOpenPlan} /> :
      <div className="app-main" style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        <div className="app-map" style={{ flex: 1, minWidth: 0, height: '100%' }}>
          <MapView scenario={mapScenario} plan={plan} selectedDate={selectedDate} walkingNetworkConfigured={routingStatus.walkingNetworkConfigured}
            mapMode={mapMode} draftRiskPoints={draftRiskPoints} selectedPatientId={selectedPatientId}
            onMapClick={handleMapClick} onSelectPatient={handleSelectPatient} />
        </div>
        <aside className="workflow-aside" style={{ width: 420, background: 'white', boxShadow: '-8px 0 24px rgba(15,23,42,.06)', display: 'flex', flexDirection: 'column', height: '100%', zIndex: 1 }}>
          <div style={{ overflowY: 'auto', flexShrink: 0, maxHeight: '50%' }}>
            <WorkflowPanel
              regions={regions} regionsError={regionsError} isLoadingRegions={isLoadingRegions}
              isLoadingRegion={isLoadingRegion} baseScenario={baseScenario} scenario={scenario} plan={plan}
              selectedStrategy={selectedStrategy} setSelectedStrategy={handleSelectStrategy}
              onSelectRegion={handleSelectRegion} onSample={handleSample}
              onGeneratePlan={handleGeneratePlan} isGenerating={isGenerating}
              planningError={planningError}
              routingStatus={routingStatus}
              onRefreshRoutingStatus={refreshRoutingStatus}
              onRefreshRegions={refreshRegions}
              sampleNotice={sampleNotice}
              staleNotice={staleNotice}
              onChangeTeams={handleChangeTeams}
              onChangeRules={rules => editScenario(current => ({ ...current, ...rules }))}
              isDrawingRisk={mapMode === 'draw-risk'}
              draftRiskPoints={draftRiskPoints}
              onStartDrawingRisk={() => { setDraftRiskPoints([]); setMapMode('draw-risk'); }}
              onCancelDrawingRisk={() => { setDraftRiskPoints([]); setMapMode('view'); }}
              onUndoRiskPoint={() => setDraftRiskPoints(points => points.slice(0, -1))}
              onFinishRisk={handleFinishRisk}
              onRemoveRisk={areaId => editScenario(current => ({ ...current, riskAreas: (current.riskAreas ?? []).filter(area => area.id !== areaId) }))}
            />
          </div>
          <Sidebar scenario={scenario} plan={plan} selectedDate={selectedDate} activeTab={sidebarTab} onChangeTab={setSidebarTab}
            onRegisterResults={handleRegisterResults}
            onRemoveVisit={handleRemoveVisit}
            patientPanel={{
              regions, currentRegionId: baseScenario?.id ?? '', selectedPatientId, isAddingPatient: mapMode === 'add-patient',
              onSelectPatient: handleSelectPatient, onUpdatePatient: handleUpdatePatient, onClearPatientFields: handleClearPatientFields,
              onRemovePatient: handleRemovePatient, onTransferPatient: handleTransferPatient,
              onToggleAddPatient: () => setMapMode(mode => mode === 'add-patient' ? 'view' : 'add-patient')
            }} />
        </aside>
      </div>
      }
    </div>
  );
};
