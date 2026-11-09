import React, { useState } from 'react';
import { Map, Calendar, FileText } from 'lucide-react';
import { Plan, Scenario } from '@routing/core';
import { getExportCsvUrl, getExportGpxUrl } from '../services/api';

interface HeaderProps {
  scenario: Scenario | null;
  plan: Plan | null;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  showRouteControls?: boolean;
  canExport?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  scenario,
  plan,
  selectedDate,
  setSelectedDate,
  showRouteControls = true,
  canExport = true,
}) => {
  // Lista de datas disponíveis no plano ou no horizonte
  const dates = plan
    ? [...new Set(plan.routes.map(r => r.date))]
    : scenario
    ? [scenario.startDate]
    : [];
  const [exportTeamId, setExportTeamId] = useState('');
  const exportableRoutes = plan?.routes.filter(route => route.date === selectedDate && route.visits.length > 0) ?? [];
  const exportRoute = exportableRoutes.find(route => route.teamId === exportTeamId) ?? exportableRoutes[0];

  return (
    <header style={{
      height: '64px',
      minHeight: '64px',
      position: 'relative',
      zIndex: 2,
      background: '#0f172a',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 1.5rem',
      gap: '1rem',
      overflowX: 'auto',
      borderBottom: '1px solid #1e293b'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Map style={{ color: '#3b82f6' }} size={26} />
        <div>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Planejamento de Visitas Domiciliares</h1>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            {scenario ? `${scenario.healthCenter.name} (Versão ${scenario.version})` : 'Nenhum cenário selecionado'}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
        {/* Seleção do Dia da Rota */}
        {showRouteControls && dates.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#1e293b', padding: '0.4rem 0.75rem', borderRadius: '0.375rem' }}>
            <Calendar size={16} style={{ color: '#94a3b8' }} />
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ background: 'transparent', color: 'white', border: 'none', outline: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
            >
              {dates.map(d => (
                <option key={d} value={d} style={{ background: '#1e293b' }}>Dia: {d}</option>
              ))}
            </select>
          </div>
        )}

        {/* Botões de Exportação CSV / GPX */}
        {showRouteControls && canExport && plan && scenario && exportRoute && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {exportableRoutes.length > 1 && <select aria-label="Equipe a exportar" value={exportRoute.teamId} onChange={event => setExportTeamId(event.target.value)}
              style={{ background: '#1e293b', color: 'white', border: 'none', borderRadius: '0.375rem', padding: '0 0.5rem', fontSize: '0.8rem' }}>
              {exportableRoutes.map(route => <option key={route.teamId} value={route.teamId}>{scenario.teams.find(team => team.id === route.teamId)?.name ?? route.teamId}</option>)}
            </select>}
            <a
              href={getExportCsvUrl(scenario.id, plan.id, selectedDate, exportRoute.teamId)}
              download
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                background: '#059669',
                color: 'white',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.375rem',
                textDecoration: 'none',
                fontSize: '0.8rem',
                fontWeight: 600
              }}
            >
              <FileText size={14} /> CSV
            </a>
            <a
              href={getExportGpxUrl(scenario.id, plan.id, selectedDate, exportRoute.teamId)}
              download
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                background: '#d97706',
                color: 'white',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.375rem',
                textDecoration: 'none',
                fontSize: '0.8rem',
                fontWeight: 600
              }}
            >
              <FileText size={14} /> GPX
            </a>
          </div>
        )}
      </div>
    </header>
  );
};
