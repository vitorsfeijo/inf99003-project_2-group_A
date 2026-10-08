import React from 'react';
import { Plan, Scenario } from '@routing/core';
import './comparison.css';

interface Props {
  scenario: Scenario;
  plans: Plan[];
  localEstimate: boolean;
  onOpenPlan: (strategyId: string, date?: string) => void;
}

const strategies: Record<string, { name: string; color: string }> = {
  'main-heuristic': { name: 'Busca mensal', color: '#2563eb' },
  'urgency-baseline': { name: 'Prioridade clínica', color: '#d97706' },
  'nearest-baseline': { name: 'Vizinho mais próximo', color: '#059669' }
};
const num = (value: number, digits = 1) => value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const hours = (minutes: number) => `${num(minutes / 60)} h`;
const countVisits = (plan: Plan) => plan.routes.reduce((sum, route) => sum + route.visits.length, 0);

const metrics: { label: string; value: (plan: Plan) => number; unit: string; digits?: number; explanation?: string }[] = [
  { label: 'Visitas alocadas', value: countVisits, unit: '', digits: 0 },
  { label: 'Visitas pendentes', value: plan => plan.unallocatedVisits.length, unit: '', digits: 0 },
  { label: 'Cobertura', value: plan => plan.metrics.coveragePercentage, unit: '%' },
  { label: 'Cobertura no prazo', value: plan => plan.metrics.onTimeCoveragePercentage, unit: '%' },
  { label: 'Cobertura ponderada pela prioridade', value: plan => plan.metrics.priorityWeightedCoveragePercentage, unit: '%' },
  { label: 'Prioridade atendida no prazo', value: plan => plan.metrics.priorityWeightedOnTimeCoveragePercentage, unit: '%' },
  { label: 'Prioridade atendida em tempo acionável', value: plan => plan.metrics.priorityWeightedPromptCoveragePercentage, unit: '%', explanation: 'Visitas já vencidas no primeiro dia útil; demais até o prazo.' },
  { label: 'Distância total a pé', value: plan => plan.metrics.totalTravelDistanceKm, unit: ' km' },
  { label: 'Tempo total em deslocamento', value: plan => plan.metrics.totalTravelTimeMinutes / 60, unit: ' h' },
  { label: 'Tempo total em atendimentos', value: plan => plan.routes.reduce((sum, route) => sum + route.totalVisitTimeMinutes, 0) / 60, unit: ' h' },
  { label: 'Tempo total de trabalho', value: plan => plan.routes.reduce((sum, route) => sum + route.totalWorkTimeMinutes, 0) / 60, unit: ' h' },
  { label: 'Parcela da jornada em deslocamento', value: plan => {
    const work = plan.routes.reduce((sum, route) => sum + route.totalWorkTimeMinutes, 0);
    return work ? 100 * plan.metrics.totalTravelTimeMinutes / work : 0;
  }, unit: '%' },
  { label: 'Distância por visita alocada', value: plan => plan.metrics.distancePerAllocatedVisitKm, unit: ' km' },
  { label: 'Deslocamento por visita alocada', value: plan => plan.metrics.travelTimePerAllocatedVisitMinutes, unit: ' min' },
  { label: 'Atraso médio ponderado pela prioridade', value: plan => plan.metrics.priorityWeightedAverageDelayDays, unit: ' dias', explanation: 'Inclui pendências censuradas no último dia da janela.' },
  { label: 'Atraso acionável ponderado', value: plan => plan.metrics.priorityWeightedActionableDelayDays, unit: ' dias', explanation: 'Conta apenas o atraso adicional depois do início da janela; inclui pendências.' },
  { label: 'P90 de atraso das visitas alocadas', value: plan => plan.metrics.p90AllocatedDelayDays, unit: ' dias' },
  { label: 'Soma dos dias de atraso', value: plan => plan.metrics.totalOverdueDays, unit: ' dias', digits: 0 },
  { label: 'Pontos prioritários no prazo por km', value: plan => plan.metrics.timelyPriorityPointsPerKm, unit: ' pts/km' },
  { label: 'Pontos prioritários alocados por km', value: plan => plan.metrics.priorityPointsPerKm, unit: ' pts/km' },
  { label: 'Utilização da jornada', value: plan => plan.metrics.teamUtilizationPercentage, unit: '%' },
  { label: 'Desequilíbrio entre equipes', value: plan => plan.metrics.teamWorkloadImbalance, unit: '', explanation: 'Desvio relativo da carga entre equipes; zero com uma única equipe.' }
];

function BarComparison({ title, plans, value, format, lowerBetter = false }: {
  title: string; plans: Plan[]; value: (plan: Plan) => number; format: (value: number) => string; lowerBetter?: boolean;
}) {
  const values = plans.map(value);
  const maximum = Math.max(1, ...values);
  const best = lowerBetter ? Math.min(...values) : Math.max(...values);
  return <section className="comparison-card comparison-chart" aria-label={title}>
    <h3>{title}</h3>
    {plans.map((plan, index) => <div className="comparison-bar-row" key={plan.strategyId}>
      <div className="comparison-bar-label"><span>{strategies[plan.strategyId]?.name ?? plan.strategyId}</span><strong>{format(values[index])}{values[index] === best ? ' ★' : ''}</strong></div>
      <div className="comparison-track"><span style={{ width: `${Math.max(0, 100 * values[index] / maximum)}%`, background: strategies[plan.strategyId]?.color ?? '#64748b' }} /></div>
    </div>)}
  </section>;
}

export const ComparisonView: React.FC<Props> = ({ scenario, plans, localEstimate, onOpenPlan }) => {
  const dates = [...new Set(plans.flatMap(plan => plan.routes.map(route => route.date)))].sort();
  const dateFormat = (date: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
  return <main className="comparison-page">
    <div className="comparison-intro">
      <div><p className="comparison-eyebrow">Análise comparativa · 1 mês de trabalho</p><h2>Três planos, a mesma demanda</h2>
        <p>{scenario.polygons[0]?.name ?? scenario.healthCenter.name} · {scenario.patients.length} pacientes simulados · {scenario.teams.length} equipe(s) · {scenario.planningHorizonDays} dias úteis</p>
      </div>
      <span className={`comparison-source ${localEstimate ? 'estimate' : ''}`}>{localEstimate ? 'Estimativa em linha reta' : 'Deslocamento a pé · OSRM'}</span>
    </div>
    {localEstimate && <p className="comparison-warning" role="status">Estimativa local: os tempos e distâncias não seguem as ruas. Use OSRM para avaliar o deslocamento realista.</p>}
    <p className="comparison-note">Os três métodos usam o mesmo cenário, versão {scenario.version}, pacientes, equipes e matriz de custos. A busca mensal parte do vizinho mais próximo e troca visitas entre dias para reduzir caminhada e atraso clínico, preservando cobertura e prioridade atendida em tempo acionável. ★ indica o melhor valor em cada indicador visualizado; não representa uma escolha clínica automática.</p>

    <div className="comparison-plan-grid">{plans.map(plan => <section className="comparison-card comparison-plan" key={plan.strategyId} style={{ borderTopColor: strategies[plan.strategyId]?.color }}>
      <h3>{strategies[plan.strategyId]?.name ?? plan.strategyId}</h3>
      <div className="comparison-plan-stats"><span><strong>{countVisits(plan)}</strong> visitas</span><span><strong>{hours(plan.metrics.totalTravelTimeMinutes)}</strong> caminhando</span><span><strong>{num(plan.metrics.totalTravelDistanceKm)}</strong> km</span></div>
      <p>{plan.unallocatedVisits.length} pendências · {num(plan.metrics.priorityWeightedPromptCoveragePercentage)}% de prioridade em tempo acionável</p>
      <button type="button" onClick={() => onOpenPlan(plan.strategyId)}>Ver rotas no mapa →</button>
    </section>)}</div>

    <div className="comparison-charts">
      <BarComparison title="Horas gastas em deslocamento" plans={plans} value={plan => plan.metrics.totalTravelTimeMinutes / 60} format={value => `${num(value)} h`} lowerBetter />
      <BarComparison title="Distância percorrida" plans={plans} value={plan => plan.metrics.totalTravelDistanceKm} format={value => `${num(value)} km`} lowerBetter />
      <BarComparison title="Prioridade atendida em tempo acionável" plans={plans} value={plan => plan.metrics.priorityWeightedPromptCoveragePercentage} format={value => `${num(value)}%`} />
      <BarComparison title="Atraso acionável ponderado" plans={plans} value={plan => plan.metrics.priorityWeightedActionableDelayDays} format={value => `${num(value)} dias`} lowerBetter />
    </div>

    <section className="comparison-card comparison-wide"><h3>Distribuição de atrasos e pendências</h3><p>Visitas previstas no mês por faixa de atraso em relação ao prazo original.</p>
      {plans.map(plan => {
        const buckets = plan.metrics.delayBuckets;
        const parts = [
          { label: 'No prazo', count: buckets.onTime, color: '#059669' },
          { label: '1–2 dias', count: buckets.oneToTwoDays, color: '#eab308' },
          { label: '3–7 dias', count: buckets.threeToSevenDays, color: '#f97316' },
          { label: 'Mais de 7 dias', count: buckets.overSevenDays, color: '#dc2626' },
          { label: 'Não alocadas', count: buckets.unallocated, color: '#64748b' }
        ];
        const total = parts.reduce((sum, part) => sum + part.count, 0);
        return <div className="comparison-delay-row" key={plan.strategyId}><strong>{strategies[plan.strategyId]?.name ?? plan.strategyId}</strong>
          <div className="comparison-stacked" role="img" aria-label={parts.map(part => `${part.label}: ${part.count}`).join(', ')}>{parts.filter(part => part.count).map(part => <span key={part.label} title={`${part.label}: ${part.count}`} style={{ width: `${100 * part.count / total}%`, background: part.color }} />)}</div>
          <span>{total} visitas</span></div>;
      })}
      <div className="comparison-legend">{[['No prazo','#059669'],['1–2 dias','#eab308'],['3–7 dias','#f97316'],['Mais de 7 dias','#dc2626'],['Não alocadas','#64748b']].map(([label,color]) => <span key={label}><i style={{ background: color }} />{label}</span>)}</div>
    </section>

    <section className="comparison-card comparison-wide"><h3>Todos os indicadores do mês</h3><div className="comparison-table-wrap"><table className="comparison-table"><thead><tr><th>Indicador</th>{plans.map(plan => <th key={plan.id}>{strategies[plan.strategyId]?.name ?? plan.strategyId}</th>)}</tr></thead>
      <tbody>{metrics.map(metric => <tr key={metric.label}><th title={metric.explanation}>{metric.label}{metric.explanation && <span className="comparison-help" aria-label={metric.explanation}> ⓘ</span>}</th>{plans.map(plan => <td key={plan.id}>{num(metric.value(plan), metric.digits ?? 1)}{metric.unit}</td>)}</tr>)}</tbody></table></div></section>

    <section className="comparison-card comparison-wide"><h3>Rotas dia a dia</h3><p>Visitas · quilômetros · minutos de caminhada. Selecione uma célula para abrir a rota no mapa.</p><div className="comparison-table-wrap"><table className="comparison-table comparison-daily"><thead><tr><th>Dia</th>{plans.map(plan => <th key={plan.id}>{strategies[plan.strategyId]?.name ?? plan.strategyId}</th>)}</tr></thead>
      <tbody>{dates.map(date => <tr key={date}><th>{dateFormat(date)}</th>{plans.map(plan => {
        const routes = plan.routes.filter(route => route.date === date);
        const visits = routes.reduce((sum, route) => sum + route.visits.length, 0);
        const km = routes.reduce((sum, route) => sum + route.totalDistanceKm, 0);
        const minutes = routes.reduce((sum, route) => sum + route.totalTravelTimeMinutes, 0);
        return <td key={plan.id}><button type="button" onClick={() => onOpenPlan(plan.strategyId, date)}>{visits} visitas · {num(km)} km · {num(minutes, 0)} min</button></td>;
      })}</tr>)}</tbody></table></div></section>
  </main>;
};
