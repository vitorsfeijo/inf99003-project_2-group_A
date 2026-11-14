import React, { useCallback, useEffect, useState } from 'react';
import { StatisticsPeriod, UsageStatistics } from '@routing/core';
import { BaseRegionSummary, StatisticsQuery, fetchStatistics, getStatisticsXlsxUrl } from '../services/api';
import { input, label } from './styles';

interface StatisticsViewProps {
  regions: BaseRegionSummary[];
  regionId: string;
  /** Muda sempre que o histórico muda (ex.: dia encerrado), para recarregar. */
  refreshKey: string;
}

const PERIODS: { id: StatisticsPeriod; label: string }[] = [
  { id: 'week', label: 'Semana' }, { id: 'month', label: 'Mês' }, { id: 'year', label: 'Ano' }
];

const number = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const plural = (count: number, one: string, many: string) => `${number(count)} ${count === 1 ? one : many}`;

const stat = (title: string, value: string, detail?: string) => (
  <div className="comparison-card" style={{ padding: 16 }}>
    <span style={{ fontSize: 12, color: '#64748b' }}>{title}</span>
    <strong style={{ display: 'block', fontSize: 26, letterSpacing: '-.03em', color: '#172033' }}>{value}</strong>
    {detail && <span style={{ fontSize: 12, color: '#64748b' }}>{detail}</span>}
  </div>
);

/** Estatísticas de uso do aplicativo numa unidade, calculadas a partir do histórico registrado. */
export const StatisticsView: React.FC<StatisticsViewProps> = ({ regions, regionId: initialRegionId, refreshKey }) => {
  const [regionId, setRegionId] = useState(initialRegionId);
  const [period, setPeriod] = useState<StatisticsPeriod>('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [stats, setStats] = useState<UsageStatistics | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const query: StatisticsQuery = { regionId, period, from: from || undefined, to: to || undefined };

  const load = useCallback(async () => {
    if (!regionId) return;
    setLoading(true);
    setError('');
    try {
      setStats(await fetchStatistics({ regionId, period, from: from || undefined, to: to || undefined }));
    } catch (failure) {
      setStats(null);
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setLoading(false);
    }
  }, [regionId, period, from, to]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const periodLabel = PERIODS.find(item => item.id === period)?.label ?? '';
  const maxReason = Math.max(1, ...(stats?.visits.missedByReason.map(item => item.count) ?? [1]));

  return (
    <main className="comparison-page" aria-label="Estatísticas de uso">
      <div className="comparison-intro">
        <div>
          <p className="comparison-eyebrow">Estatísticas de uso</p>
          <h2>O que aconteceu nas visitas</h2>
          <p>Calculadas a partir dos dias encerrados, das retiradas de rota, das transferências e do cadastro atual dos pacientes.</p>
        </div>
        {regionId && <a className="comparison-source" href={getStatisticsXlsxUrl(query)} download style={{ textDecoration: 'none' }}>Exportar para Excel</a>}
      </div>

      <div className="comparison-card" style={{ display: 'grid', gridTemplateColumns: 'minmax(200px,2fr) repeat(3, minmax(120px,1fr))', gap: 12, margin: '18px 0' }}>
        <div><label style={label} htmlFor="stats-region">Unidade</label>
          <select id="stats-region" style={input} value={regionId} onChange={event => setRegionId(event.target.value)}>
            <option value="">Escolha uma unidade</option>
            {regions.map(region => <option key={region.id} value={region.id}>{region.name}</option>)}
          </select></div>
        <div><label style={label} htmlFor="stats-period">Agrupar por</label>
          <select id="stats-period" style={input} value={period} onChange={event => setPeriod(event.target.value as StatisticsPeriod)}>
            {PERIODS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select></div>
        <div><label style={label} htmlFor="stats-from">De</label>
          <input id="stats-from" style={input} type="date" value={from} onChange={event => setFrom(event.target.value)} /></div>
        <div><label style={label} htmlFor="stats-to">Até</label>
          <input id="stats-to" style={input} type="date" min={from || undefined} value={to} onChange={event => setTo(event.target.value)} /></div>
      </div>

      {!regionId && <p className="comparison-note">Escolha uma unidade para ver as estatísticas.</p>}
      {error && <div role="alert" className="comparison-warning">{error}</div>}
      {loading && <p className="comparison-note">Calculando…</p>}

      {stats && !loading && <>
        <div className="comparison-plan-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0,1fr))' }}>
          {stat('Visitas registradas', number(stats.visits.attempted), plural(stats.visits.completed, 'concluída', 'concluídas'))}
          {stat('Não realizadas', `${number(stats.visits.missedPercentage)}%`, plural(stats.visits.missed, 'visita', 'visitas'))}
          {stat('Retiradas da rota por aviso', number(stats.visits.removedFromRoute), 'antes da visita')}
          {stat('Transferências', plural(stats.transfers.out, 'enviada', 'enviadas'), plural(stats.transfers.in, 'recebida', 'recebidas'))}
        </div>

        <div className="comparison-charts">
          <section className="comparison-card comparison-chart" aria-label="Motivos das visitas não realizadas">
            <h3>Por que as visitas não aconteceram</h3>
            {stats.visits.missedByReason.length === 0
              ? <p className="comparison-note">Nenhuma visita não realizada no período.</p>
              : stats.visits.missedByReason.map(item => (
                <div key={item.reason} className="comparison-bar-row">
                  <div className="comparison-bar-label"><span>{item.reason}</span><strong>{item.count} · {number(item.percentage)}%</strong></div>
                  <div className="comparison-track"><span style={{ width: `${(item.count / maxReason) * 100}%`, background: '#dc2626' }} /></div>
                </div>
              ))}
          </section>

          <section className="comparison-card comparison-chart" aria-label="Pacientes atendidos por equipe">
            <h3>Pacientes atendidos por equipe · {periodLabel.toLowerCase()}</h3>
            {stats.teams.length === 0 ? <p className="comparison-note">Nenhuma visita concluída no período.</p> : (
              <div className="comparison-table-wrap">
                <table className="comparison-table" style={{ minWidth: 0 }}>
                  <thead><tr><th>Equipe</th><th>{periodLabel}</th><th>Visitas concluídas</th><th>Pacientes atendidos</th></tr></thead>
                  <tbody>{stats.teams.flatMap(team => team.buckets.map(bucket => (
                    <tr key={`${team.teamId}-${bucket.period}`}><th>{team.teamName}</th><td>{bucket.period}</td><td>{bucket.completedVisits}</td><td>{bucket.patientsServed}</td></tr>
                  )))}</tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <section className="comparison-card comparison-wide" aria-label="Pacientes por área do território">
          <h3>Cadastro atual por área do território</h3>
          {stats.areas.length === 0 ? <p className="comparison-note">Sem cadastro salvo para esta unidade.</p> : (
            <div className="comparison-table-wrap">
              <table className="comparison-table">
                <thead><tr><th>Área</th><th>Pacientes</th><th>Âncoras</th><th>Prazo rígido</th><th>Folga própria</th><th>Ausência programada</th><th>Exigem 2+ profissionais</th></tr></thead>
                <tbody>{stats.areas.map(area => (
                  <tr key={area.areaId}><th>{area.areaName}</th><td>{area.patients}</td><td>{area.anchors}</td><td>{area.hardDeadlines}</td>
                    <td>{area.withBuffer}</td><td>{area.withTimeout}</td><td>{area.needsMultipleStaff}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <p className="comparison-note" style={{ marginBottom: 0 }}>O GeoSaúde fornece o contorno da unidade, não o das microáreas: cada polígono do contorno aparece como uma área, e os pacientes incluídos fora dele aparecem à parte.</p>
        </section>
      </>}
    </main>
  );
};
