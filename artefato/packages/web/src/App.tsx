import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Scenario, Plan, VisitResult, planScenario, sampleTerritoryPatients, countWorkingDaysInNextMonth } from '@routing/core';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MapView } from './components/MapView';
import { WorkflowPanel } from './components/WorkflowPanel';
import { ComparisonView } from './components/ComparisonView';
import { BaseRegionSummary, fetchBaseRegion, fetchBaseRegions, fetchRoutingStatus, generateComparison, registerVisitResults, saveScenario } from './services/api';

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
  const [walkingNetworkConfigured, setWalkingNetworkConfigured] = useState(false);
  const [localEstimate, setLocalEstimate] = useState(false);
  const [planningError, setPlanningError] = useState('');
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
        ? 'API indisponível na porta 3001. Inicie o backend com OSRM_BASE_URL configurada e tente novamente.'
        : error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoadingRegions(false);
    }
  };

  const refreshRoutingStatus = async () => {
    try {
      const status = await fetchRoutingStatus();
      setWalkingNetworkConfigured(status.walkingNetworkConfigured);
    } catch {
      setWalkingNetworkConfigured(false);
    }
  };

  const handleSelectRegion = async (id: string) => {
    const requestId = ++selectionRequest.current;
    setBaseScenario(null);
    setScenario(null);
    setPlan(null);
    setComparisonPlans([]);
    setActiveView('routes');
    setLocalEstimate(false);
    setPlanningError('');
    setSelectedDate('');
    setRegionsError('');
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

  const handleSample = (count: number, seed: number) => {
    if (!baseScenario) return;
    try {
      const monthlyBase = { ...baseScenario, planningHorizonDays: countWorkingDaysInNextMonth(baseScenario.startDate) };
      const sampled = sampleTerritoryPatients(monthlyBase, count, seed);
      setScenario(sampled);
      setPlan(null);
      setComparisonPlans([]);
      setActiveView('routes');
      setLocalEstimate(false);
      setPlanningError('');
      setSelectedDate(sampled.startDate);
    } catch (error) {
      alert(`Erro na amostragem: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleGeneratePlan = async () => {
    if (!scenario || isGenerating || !walkingNetworkConfigured) return;
    setIsGenerating(true);
    setPlan(null);
    setPlanningError('');
    try {
      await saveScenario(scenario);
      const plans = await generateComparison(scenario.id, scenario.version);
      const newPlan = plans.find(item => item.strategyId === selectedStrategy) ?? plans[0];
      if (!newPlan) throw new Error('Nenhum plano foi retornado.');
      setLocalEstimate(false);
      setComparisonPlans(plans);
      setPlan(newPlan);
      setActiveView('routes');
      if (newPlan.routes.length > 0) setSelectedDate(newPlan.routes[0].date);
    } catch (error) {
      if (error instanceof TypeError) {
        setPlanningError('A API parou de responder durante o cálculo. Verifique o backend na porta 3001 e tente novamente.');
        setWalkingNetworkConfigured(false);
      } else {
        setPlanningError(`Erro ao gerar cronograma: ${error instanceof Error ? error.message : String(error)}`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateLocalEstimate = () => {
    if (!scenario) return;
    try {
      const plans = ['main-heuristic', 'urgency-baseline', 'nearest-baseline']
        .map(strategyId => planScenario(scenario, { strategyId, enable1_5Opt: true }));
      setComparisonPlans(plans);
      setPlan(plans.find(item => item.strategyId === selectedStrategy) ?? plans[0]);
      setLocalEstimate(true);
      setActiveView('routes');
      setPlanningError('Estimativa local em linha reta. As distâncias não representam o percurso a pé.');
    } catch (error) {
      setPlanningError(`Erro no planejamento local: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleRegisterResults = async (results: VisitResult[]) => {
    if (!scenario) return false;
    try {
      const { scenarioVersion, plan: newPlan } = await registerVisitResults(
        scenario.id, results, selectedDate,
        { strategyId: selectedStrategy, enable1_5Opt: true }, scenario.version
      );
      setScenario(previous => previous ? { ...previous, version: scenarioVersion } : null);
      setPlan(newPlan);
      setComparisonPlans([]);
      setActiveView('routes');
      setLocalEstimate(false);
      alert('Resultados registrados e replanejamento gerado com sucesso!');
      return true;
    } catch (error) {
      alert(`Erro ao registrar resultados via servidor: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  };

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
        showRouteControls={activeView === 'routes'} canExport={!localEstimate} />
      <nav className="view-tabs" aria-label="Telas do planejamento"><button type="button" aria-current={activeView === 'routes' ? 'page' : undefined} onClick={() => setActiveView('routes')}>Mapa e rotas</button><button type="button" disabled={!comparisonPlans.length} aria-current={activeView === 'comparison' ? 'page' : undefined} onClick={() => setActiveView('comparison')}>Comparar planos {comparisonPlans.length ? `(${comparisonPlans.length})` : ''}</button></nav>
      {activeView === 'comparison' && scenario && comparisonPlans.length ?
        <ComparisonView scenario={scenario} plans={comparisonPlans} localEstimate={localEstimate} onOpenPlan={handleOpenPlan} /> :
      <div className="app-main" style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        <div className="app-map" style={{ flex: 1, minWidth: 0, height: '100%' }}>
          <MapView scenario={mapScenario} plan={plan} selectedDate={selectedDate} walkingNetworkConfigured={walkingNetworkConfigured} localEstimate={localEstimate} />
        </div>
        <aside className="workflow-aside" style={{ width: 400, background: 'white', boxShadow: '-8px 0 24px rgba(15,23,42,.06)', display: 'flex', flexDirection: 'column', height: '100%', zIndex: 1 }}>
          <div style={{ overflowY: 'auto', flexShrink: 0, maxHeight: '55%' }}>
            <WorkflowPanel
              regions={regions} regionsError={regionsError} isLoadingRegions={isLoadingRegions}
              isLoadingRegion={isLoadingRegion} baseScenario={baseScenario} scenario={scenario} plan={plan}
              selectedStrategy={selectedStrategy} setSelectedStrategy={handleSelectStrategy}
              onSelectRegion={handleSelectRegion} onSample={handleSample}
              onGeneratePlan={handleGeneratePlan} isGenerating={isGenerating}
              onGenerateLocalEstimate={handleGenerateLocalEstimate} planningError={planningError}
              walkingNetworkConfigured={walkingNetworkConfigured}
              onRefreshRoutingStatus={refreshRoutingStatus}
              onRefreshRegions={refreshRegions}
            />
          </div>
          <Sidebar scenario={scenario} plan={plan} selectedDate={selectedDate} onRegisterResults={handleRegisterResults} localEstimate={localEstimate} />
        </aside>
      </div>
      }
    </div>
  );
};
