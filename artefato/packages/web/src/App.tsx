import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Scenario, Plan, VisitResult, Patient, Team, Coordinates, sampleTerritoryPatients, countWorkingDaysInNextMonth, isPointInAnyPolygon } from '@routing/core';
import { Header } from './components/Header';
import { Sidebar, SidebarTab } from './components/Sidebar';
import { MapMode, MapView } from './components/MapView';
import { WorkflowPanel } from './components/WorkflowPanel';
import { ComparisonView } from './components/ComparisonView';
import { BaseRegionSummary, RoutingStatus, createTransfer, fetchBaseRegion, fetchBaseRegions, fetchIncomingPatients, fetchRoutingStatus, generateComparison, registerVisitResults, saveScenario } from './services/api';

const STALE_PLAN_NOTICE = 'O cenário mudou: gere os planos novamente para aplicar as alterações.';

export const App: React.FC = () => {
  const [baseScenario, setBaseScenario] = useState<Scenario | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [comparisonPlans, setComparisonPlans] = useState<Plan[]>([]);
  const [activeView, setActiveView] = useState<'routes' | 'comparison'>('routes');
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
  }, []);

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
        showRouteControls={activeView === 'routes'} canExport />
      <nav className="view-tabs" aria-label="Telas do planejamento"><button type="button" aria-current={activeView === 'routes' ? 'page' : undefined} onClick={() => setActiveView('routes')}>Mapa e rotas</button><button type="button" disabled={!comparisonPlans.length} aria-current={activeView === 'comparison' ? 'page' : undefined} onClick={() => setActiveView('comparison')}>Comparar planos {comparisonPlans.length ? `(${comparisonPlans.length})` : ''}</button></nav>
      {activeView === 'comparison' && scenario && comparisonPlans.length ?
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
