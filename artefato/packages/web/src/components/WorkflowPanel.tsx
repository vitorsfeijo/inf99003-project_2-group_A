import React, { useState } from 'react';
import { Coordinates, Plan, Scenario, Team, countWorkingDaysInNextMonth } from '@routing/core';
import { BaseRegionSummary, RoutingStatus } from '../services/api';
import { card, input, label } from './styles';
import { TeamEditor } from './TeamEditor';
import { RiskAreaPanel } from './RiskAreaPanel';

interface WorkflowPanelProps {
  regions: BaseRegionSummary[];
  regionsError: string;
  isLoadingRegions: boolean;
  isLoadingRegion: boolean;
  baseScenario: Scenario | null;
  scenario: Scenario | null;
  plan: Plan | null;
  selectedStrategy: string;
  setSelectedStrategy: (strategy: string) => void;
  onSelectRegion: (id: string) => void;
  onSample: (count: number, seed: number) => void;
  onGeneratePlan: () => void;
  planningError: string;
  isGenerating: boolean;
  routingStatus: RoutingStatus;
  onRefreshRoutingStatus: () => void;
  onRefreshRegions: () => void;
  sampleNotice: string;
  staleNotice: string;
  onChangeTeams: (update: (teams: Team[]) => Team[]) => void;
  onChangeRules: (rules: Partial<Pick<Scenario, 'visitBufferMinutes' | 'deadlineSafetyMarginDays'>>) => void;
  isDrawingRisk: boolean;
  draftRiskPoints: Coordinates[];
  onStartDrawingRisk: () => void;
  onCancelDrawingRisk: () => void;
  onUndoRiskPoint: () => void;
  onFinishRisk: (name: string, reason: string) => void;
  onRemoveRisk: (areaId: string) => void;
}

const ROUTER_LABEL: Record<string, string> = {
  internal: 'Roteador interno (mapa OpenStreetMap local, sem Docker)',
  osrm: 'OSRM externo'
};

export const WorkflowPanel: React.FC<WorkflowPanelProps> = props => {
  // O painel é remontado ao voltar da comparação; o território carregado vem do App.
  const [regionId, setRegionId] = useState(props.baseScenario?.id ?? '');
  const [count, setCount] = useState(30);
  const [seed, setSeed] = useState(20261008);
  const walkingNetworkConfigured = props.routingStatus.walkingNetworkConfigured;
  const step = (number: number, title: string, complete: boolean) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
      <span style={{ width: 25, height: 25, borderRadius: 9, display: 'grid', placeItems: 'center', background: complete ? '#dcfce7' : '#dbeafe', color: complete ? '#166534' : '#1d4ed8', fontSize: 13, fontWeight: 800 }}>{complete ? '✓' : number}</span>
      <strong style={{ fontSize: 14, color: '#0f172a' }}>{title}</strong>
    </div>
  );
  return (
    <div style={{ padding: 16, background: '#f8fafc', display: 'grid', gap: 12, WebkitFontSmoothing: 'antialiased', fontVariantNumeric: 'tabular-nums' }}>
      <div>
        <h2 style={{ fontSize: 17, lineHeight: 1.25, textWrap: 'balance' }}>Montar cronograma</h2>
        <p style={{ fontSize: 12, color: '#64748b', marginTop: 4, lineHeight: 1.4 }}>Contornos e unidade do GeoSaúde · pacientes simulados</p>
      </div>
      <section style={card} aria-label="Etapa 1: selecionar região">
        {step(1, 'Selecionar região real', Boolean(props.baseScenario))}
        <label htmlFor="base-region" style={label}>Território da Atenção Primária</label>
        <select id="base-region" style={input} value={regionId} disabled={props.isLoadingRegions} onChange={event => { setRegionId(event.target.value); props.onSelectRegion(event.target.value); }}>
          <option value="">{props.isLoadingRegions ? 'Carregando regiões…' : 'Escolha uma região GeoSaúde'}</option>
          {props.regions.map(region => <option key={region.id} value={region.id}>{region.name}</option>)}
        </select>
        {props.regionsError && <div role="alert" style={{ color: '#b91c1c', fontSize: 12, marginTop: 8 }}>
          {props.regionsError}
          <button type="button" onClick={() => { props.onRefreshRegions(); props.onRefreshRoutingStatus(); }} style={{ display: 'block', minHeight: 40, padding: '0 8px', background: 'transparent', color: '#1d4ed8', border: 'none', fontWeight: 700, cursor: 'pointer' }}>Tentar novamente</button>
        </div>}
        {props.isLoadingRegion && <p style={{ color: '#64748b', fontSize: 12, marginTop: 8 }}>Carregando contorno…</p>}
        {props.baseScenario && <p style={{ color: '#475569', fontSize: 12, marginTop: 8 }}>{props.baseScenario.polygons.length} polígono(s) reais · {props.baseScenario.healthCenter.name}</p>}
      </section>
      <section style={{ ...card, opacity: props.baseScenario ? 1 : .65 }} aria-label="Etapa 2: amostrar pacientes">
        {step(2, 'Amostrar pacientes', Boolean(props.scenario))}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><label htmlFor="sample-count" style={label}>Quantidade</label><input id="sample-count" type="number" min={1} max={1000} step={1} value={count} disabled={!props.baseScenario} onChange={event => setCount(Number(event.target.value))} style={input} /></div>
          <div><label htmlFor="sample-seed" style={label}>Semente</label><input id="sample-seed" type="number" min={0} max={4294967295} step={1} value={seed} disabled={!props.baseScenario} onChange={event => setSeed(Number(event.target.value))} style={input} /></div>
        </div>
        <button type="button" disabled={!props.baseScenario || !Number.isInteger(count) || count < 1 || count > 1000 || !Number.isSafeInteger(seed) || seed < 0 || seed > 4294967295} onClick={() => props.onSample(count, seed)} style={{ ...input, marginTop: 10, background: '#e0e7ff', border: 'none', color: '#1e40af', fontWeight: 700, cursor: props.baseScenario ? 'pointer' : 'not-allowed' }}>Amostrar no território</button>
        <p style={{ fontSize: 11, lineHeight: 1.4, color: '#64748b', marginTop: 8 }}>Endereços e perfis clínicos são sintéticos. A mesma semente reproduz a amostra. Edite pacientes na aba “Pacientes”.</p>
        {props.baseScenario && <p style={{ fontSize: 12, color: '#334155', marginTop: 7 }}>Janela: 1 mês a partir de {props.baseScenario.startDate} · {countWorkingDaysInNextMonth(props.baseScenario.startDate)} dias úteis</p>}
        {props.scenario && <p style={{ fontSize: 12, color: '#166534', marginTop: 7 }}>{props.scenario.patients.length} pacientes no cenário</p>}
        {props.sampleNotice && <p role="status" style={{ fontSize: 12, color: '#6b21a8', marginTop: 7 }}>{props.sampleNotice}</p>}
      </section>
      <section style={{ ...card, opacity: props.scenario ? 1 : .65 }} aria-label="Etapa 3: equipes, profissionais e regras">
        {step(3, 'Equipes, profissionais e folgas', false)}
        {props.scenario
          ? <TeamEditor scenario={props.scenario} disabled={props.isGenerating} onChangeTeams={props.onChangeTeams} onChangeRules={props.onChangeRules} />
          : <p style={{ fontSize: 12, color: '#64748b' }}>Amostre pacientes para configurar as equipes.</p>}
        {props.scenario && <div style={{ marginTop: 14 }}>
          <span style={label}>Áreas de risco</span>
          <RiskAreaPanel riskAreas={props.scenario.riskAreas ?? []} isDrawing={props.isDrawingRisk} draftPoints={props.draftRiskPoints}
            disabled={props.isGenerating} riskAreasSupported={props.routingStatus.riskAreasSupported ?? false}
            onStartDrawing={props.onStartDrawingRisk} onCancelDrawing={props.onCancelDrawingRisk} onUndoPoint={props.onUndoRiskPoint}
            onFinishDrawing={props.onFinishRisk} onRemove={props.onRemoveRisk} />
        </div>}
      </section>
      <section style={{ ...card, opacity: props.scenario ? 1 : .65 }} aria-label="Etapa 4: gerar cronograma">
        {step(4, 'Gerar e comparar os planos', Boolean(props.plan))}
        <label htmlFor="strategy" style={label}>Estratégia de planejamento</label>
        <select id="strategy" style={input} disabled={!props.scenario || props.isGenerating} value={props.selectedStrategy} onChange={event => props.setSelectedStrategy(event.target.value)}>
          <option value="main-heuristic">Busca mensal · prioridade + caminhada</option>
          <option value="urgency-baseline">Prioridade clínica</option>
          <option value="nearest-baseline">Vizinho mais próximo</option>
        </select>
        <button type="button" disabled={!props.scenario || props.isGenerating || !walkingNetworkConfigured} onClick={props.onGeneratePlan} style={{ ...input, marginTop: 10, background: '#2563eb', border: 'none', color: 'white', fontWeight: 700, cursor: props.scenario && walkingNetworkConfigured ? 'pointer' : 'not-allowed', opacity: props.scenario && walkingNetworkConfigured ? 1 : .6 }}>
          {props.isGenerating ? 'Calculando três planos a pé…' : 'Gerar e comparar planos'}
        </button>
        {props.staleNotice && !props.plan && <p role="status" style={{ color: '#92400e', background: '#fffbeb', borderRadius: 8, padding: 8, fontSize: 12, lineHeight: 1.4, marginTop: 8 }}>{props.staleNotice}</p>}
        {props.planningError && <p role="alert" style={{ color: '#991b1b', background: '#fef2f2', borderRadius: 8, padding: 10, fontSize: 12, lineHeight: 1.4, marginTop: 8 }}>{props.planningError}</p>}
        {walkingNetworkConfigured && props.routingStatus.router && <p style={{ color: '#475569', fontSize: 11, marginTop: 8 }}>Caminhada: {ROUTER_LABEL[props.routingStatus.router] ?? props.routingStatus.router}</p>}
        {!walkingNetworkConfigured && <div role="status" style={{ color: '#92400e', fontSize: 12, lineHeight: 1.4, marginTop: 8 }}>
          {props.regionsError ? 'A API está indisponível; verifique o backend na porta 3001.' : props.routingStatus.detail ?? 'Nenhum roteador de caminhada disponível. Execute "npm run prepare-map" e reinicie.'}
          <button type="button" onClick={props.onRefreshRoutingStatus} style={{ display: 'block', minHeight: 40, marginTop: 5, padding: '0 8px', background: 'transparent', color: '#1d4ed8', border: 'none', fontWeight: 700, cursor: 'pointer' }}>Verificar novamente</button>
        </div>}
        {props.plan && <p style={{ color: '#166534', fontSize: 12, marginTop: 8 }}>Cronograma pronto · {props.plan.routes.length} rotas diárias. A comparação está na aba “Comparar planos”.</p>}
      </section>
    </div>
  );
};
