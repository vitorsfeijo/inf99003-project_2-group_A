import React, { useState, useEffect } from 'react';
import { Scenario, Plan, VisitResult, planScenario } from '@routing/core';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MapView } from './components/MapView';
import { fetchExperimentalScenario, fetchExperimentalScenarios, generatePlan, registerVisitResults, saveScenario, ExperimentalScenarioSummary } from './services/api';

const defaultScenario: Scenario = {
  id: 'cenario_demo',
  version: 1,
  healthCenter: {
    id: 'hc_central',
    name: 'Posto de Saúde Central',
    location: { lat: -30.0346, lng: -51.2177 }
  },
  polygons: [
    {
      id: 'poly_centro',
      name: 'Região de Atuação APS',
      vertices: [
        { lat: -30.0200, lng: -51.2300 },
        { lat: -30.0200, lng: -51.2000 },
        { lat: -30.0500, lng: -51.2000 },
        { lat: -30.0500, lng: -51.2300 }
      ]
    }
  ],
  patients: [
    {
      id: 'pat_01',
      code: 'P001 - Maria',
      location: { lat: -30.0300, lng: -51.2200 },
      defaultVisitDurationMinutes: 40,
      conditions: [{ conditionId: 'hipertensao', lastVisitDate: '2026-09-01', maxIntervalDays: 14, priorityWeight: 4 }]
    },
    {
      id: 'pat_02',
      code: 'P002 - João',
      location: { lat: -30.0400, lng: -51.2100 },
      defaultVisitDurationMinutes: 30,
      conditions: [{ conditionId: 'diabetes', lastVisitDate: '2026-09-05', maxIntervalDays: 10, priorityWeight: 5 }]
    },
    {
      id: 'pat_03',
      code: 'P003 - Ana',
      location: { lat: -30.0250, lng: -51.2150 },
      defaultVisitDurationMinutes: 45,
      conditions: [{ conditionId: 'curativo', initialDueDate: '2026-09-28', maxIntervalDays: 7, priorityWeight: 3 }]
    }
  ],
  teams: [
    {
      id: 'eq_alpha',
      name: 'Equipe Alpha',
      doctorName: 'Dr. Carlos',
      nurseName: 'Enf. Juliana',
      socialWorkerName: 'AS Roberto',
      dailyWorkMinutes: 240,
      availableDays: ['2026-09-29', '2026-09-30']
    }
  ],
  startDate: '2026-09-29',
  planningHorizonDays: 2,
  maxAnticipationDays: 2,
  costParameters: {
    travelSpeedKmh: 20
  }
};

export const App: React.FC = () => {
  const [scenario, setScenario] = useState<Scenario>(defaultScenario);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('2026-09-29');
  const [selectedStrategy, setSelectedStrategy] = useState<string>('main-heuristic');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [experimentalScenarios, setExperimentalScenarios] = useState<ExperimentalScenarioSummary[]>([]);
  const [isLoadingExperimentalScenarios, setIsLoadingExperimentalScenarios] = useState<boolean>(true);

  // Inicializar o banco de dados via API ou calcular offline se backend indisponível
  useEffect(() => {
    saveScenario(defaultScenario).catch(() => {
      console.log('Servidor backend offline; utilizando modo de cálculo local em memória.');
    });
    fetchExperimentalScenarios()
      .then(setExperimentalScenarios)
      .catch(() => setExperimentalScenarios([]))
      .finally(() => setIsLoadingExperimentalScenarios(false));
  }, []);

  const handleImportScenario = (newScenario: Scenario) => {
    setScenario(newScenario);
    setPlan(null);
    setSelectedDate(newScenario.startDate);
    saveScenario(newScenario).catch(() => {
      console.log('Cenário carregado localmente; servidor backend indisponível.');
    });
  };

  const handleLoadExperimentalScenario = async (scenarioId: string) => {
    try {
      const newScenario = await fetchExperimentalScenario(scenarioId);
      handleImportScenario(newScenario);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleGeneratePlan = async () => {
    setIsGenerating(true);
    try {
      // Tentar via servidor backend
      const newPlan = await generatePlan(scenario.id, {
        strategyId: selectedStrategy,
        enable1_5Opt: true
      });
      setPlan(newPlan);
      if (newPlan.routes.length > 0) {
        setSelectedDate(newPlan.routes[0].date);
      }
    } catch (err) {
      // Fallback para cálculo direto em memória via @routing/core
      try {
        const fallbackPlan = planScenario(scenario, {
          strategyId: selectedStrategy,
          enable1_5Opt: true
        });
        setPlan(fallbackPlan);
        if (fallbackPlan.routes.length > 0) {
          setSelectedDate(fallbackPlan.routes[0].date);
        }
      } catch (localErr: any) {
        alert(`Erro ao gerar plano: ${localErr.message}`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegisterResults = async (results: VisitResult[]) => {
    try {
      const { scenarioVersion, plan: newPlan } = await registerVisitResults(
        scenario.id,
        results,
        selectedDate,
        { strategyId: selectedStrategy, enable1_5Opt: true }
      );
      setScenario(prev => ({ ...prev, version: scenarioVersion }));
      setPlan(newPlan);
      alert('Resultados registrados e replanejamento gerado com sucesso!');
    } catch (err) {
      alert('Erro ao registrar resultados via servidor.');
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header
        scenario={scenario}
        plan={plan}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        selectedStrategy={selectedStrategy}
        setSelectedStrategy={setSelectedStrategy}
        onGeneratePlan={handleGeneratePlan}
        isGenerating={isGenerating}
      />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, height: '100%' }}>
          <MapView scenario={scenario} plan={plan} selectedDate={selectedDate} />
        </div>
        <Sidebar
          scenario={scenario}
          plan={plan}
          selectedDate={selectedDate}
          experimentalScenarios={experimentalScenarios}
          isLoadingExperimentalScenarios={isLoadingExperimentalScenarios}
          onLoadExperimentalScenario={handleLoadExperimentalScenario}
          onImportScenario={handleImportScenario}
          onRegisterResults={handleRegisterResults}
        />
      </div>
    </div>
  );
};
