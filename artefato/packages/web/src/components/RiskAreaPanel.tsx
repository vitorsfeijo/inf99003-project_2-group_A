import React, { useState } from 'react';
import { Coordinates, RiskArea } from '@routing/core';
import { dangerLink, hint, input, secondaryButton } from './styles';

interface RiskAreaPanelProps {
  riskAreas: RiskArea[];
  isDrawing: boolean;
  draftPoints: Coordinates[];
  disabled: boolean;
  riskAreasSupported: boolean;
  onStartDrawing: () => void;
  onCancelDrawing: () => void;
  onUndoPoint: () => void;
  onFinishDrawing: (name: string, reason: string) => void;
  onRemove: (areaId: string) => void;
}

/** Áreas que a equipe considera perigosas: as rotas desviam delas sempre que existir outro caminho. */
export const RiskAreaPanel: React.FC<RiskAreaPanelProps> = props => {
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  const finish = () => {
    props.onFinishDrawing(name.trim() || `Área de risco ${props.riskAreas.length + 1}`, reason.trim());
    setName('');
    setReason('');
  };

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {props.riskAreas.length > 0 && <ul style={{ listStyle: 'none', display: 'grid', gap: 4 }}>
        {props.riskAreas.map(area => (
          <li key={area.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, background: '#fef2f2', borderRadius: 8, padding: '4px 8px' }}>
            <span>⚠️ <strong>{area.name}</strong>{area.reason ? ` · ${area.reason}` : ''}</span>
            <button type="button" style={dangerLink} disabled={props.disabled} onClick={() => props.onRemove(area.id)}>Remover</button>
          </li>
        ))}
      </ul>}
      {props.isDrawing ? (
        <div style={{ display: 'grid', gap: 6, border: '1px dashed #b91c1c', borderRadius: 10, padding: 8 }}>
          <p style={{ fontSize: 12, color: '#7f1d1d' }}>Clique no mapa para marcar os cantos da área ({props.draftPoints.length} marcados; mínimo 3).</p>
          <input aria-label="Nome da área de risco" placeholder="Nome (ex.: Beco X, trecho da Rua Y)" style={input} value={name} onChange={event => setName(event.target.value)} />
          <input aria-label="Motivo" placeholder="Motivo (opcional)" style={input} value={reason} onChange={event => setReason(event.target.value)} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            <button type="button" style={{ ...secondaryButton, background: '#fee2e2', color: '#991b1b' }} disabled={props.draftPoints.length < 3} onClick={finish}>Concluir</button>
            <button type="button" style={secondaryButton} disabled={!props.draftPoints.length} onClick={props.onUndoPoint}>Desfazer ponto</button>
            <button type="button" style={secondaryButton} onClick={props.onCancelDrawing}>Cancelar</button>
          </div>
        </div>
      ) : (
        <button type="button" style={{ ...secondaryButton, background: '#fee2e2', color: '#991b1b' }} disabled={props.disabled} onClick={props.onStartDrawing}>⚠️ Marcar área de risco no mapa</button>
      )}
      {!props.riskAreasSupported && props.riskAreas.length > 0 && <p role="alert" style={{ ...hint, color: '#991b1b' }}>O roteador atual (OSRM externo) não desvia de áreas: inicie sem ROUTER=osrm para usar o roteador interno.</p>}
      <p style={hint}>As rotas evitam passar por essas áreas sempre que houver outro caminho. Se um paciente mora dentro de uma delas, a rota entra só o necessário para chegar até ele.</p>
    </div>
  );
};
