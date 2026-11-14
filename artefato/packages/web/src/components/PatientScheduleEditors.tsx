import React, { useState } from 'react';
import { Patient, Scenario, effectiveVisitTimes } from '@routing/core';
import { chip, dangerLink, hint, input, label, linkButton, secondaryButton } from './styles';

interface EditorProps {
  patient: Patient;
  scenario: Scenario;
  onUpdatePatient: (patientId: string, patch: Partial<Patient> | ((patient: Patient) => Partial<Patient>)) => void;
  onClearPatientFields: (patientId: string, fields: (keyof Patient)[]) => void;
}

export function formatShortDate(date: string): string {
  const [, month, day] = date.split('-');
  return `${day}/${month}`;
}

const inlineLink: React.CSSProperties = { ...linkButton, minHeight: 0, padding: 0, fontSize: 11 };

/**
 * Duração do atendimento e folga após a visita. "Só na próxima visita" grava um ajuste que é
 * descartado quando a visita é concluída; "Sempre" muda o cadastro do paciente.
 */
export const VisitTimesEditor: React.FC<EditorProps> = ({ patient, scenario, onUpdatePatient, onClearPatientFields }) => {
  const [scope, setScope] = useState<'next' | 'always'>(patient.nextVisit ? 'next' : 'always');
  const generalBuffer = scenario.visitBufferMinutes ?? 0;
  const permanentBuffer = patient.visitBufferMinutes ?? generalBuffer;
  const effective = effectiveVisitTimes(patient, generalBuffer);
  const shownDuration = scope === 'next' ? effective.durationMinutes : patient.defaultVisitDurationMinutes || 30;
  const shownBuffer = scope === 'next' ? effective.bufferMinutes : permanentBuffer;
  const minutes = (value: string, minimum: number, fallback: number) => Math.min(240, Math.max(minimum, Math.round(Number(value)) || fallback));
  const setDuration = (value: number) => scope === 'always'
    ? onUpdatePatient(patient.id, { defaultVisitDurationMinutes: value })
    : onUpdatePatient(patient.id, current => ({ nextVisit: { ...current.nextVisit, durationMinutes: value } }));
  const setBuffer = (value: number) => scope === 'always'
    ? onUpdatePatient(patient.id, { visitBufferMinutes: value })
    : onUpdatePatient(patient.id, current => ({ nextVisit: { ...current.nextVisit, bufferMinutes: value } }));

  return (
    <fieldset aria-label="Duração e folga da visita" style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 8, display: 'grid', gap: 6 }}>
      <legend style={{ ...label, padding: '0 4px', marginBottom: 0 }}>Duração e folga da visita</legend>
      <div role="radiogroup" aria-label="Vale para" style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        <button type="button" role="radio" aria-checked={scope === 'next'} style={chip(scope === 'next')} onClick={() => setScope('next')}>Só na próxima visita</button>
        <button type="button" role="radio" aria-checked={scope === 'always'} style={chip(scope === 'always')} onClick={() => setScope('always')}>Sempre para este paciente</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <div><label style={label} htmlFor="patient-duration">Atendimento (min)</label>
          <input id="patient-duration" style={input} type="number" min={5} max={240} step={5} value={shownDuration}
            onChange={event => setDuration(minutes(event.target.value, 5, 30))} /></div>
        <div><label style={label} htmlFor="patient-buffer">Folga depois (min)</label>
          <input id="patient-buffer" style={input} type="number" min={0} max={120} step={5} value={shownBuffer}
            onChange={event => setBuffer(minutes(event.target.value, 0, 0))} /></div>
      </div>
      {patient.nextVisit && <p style={{ ...hint, marginTop: 0, color: '#92400e' }}>
        Próxima visita: {effective.durationMinutes} min + {effective.bufferMinutes} min de folga, só uma vez.{' '}
        <button type="button" style={inlineLink} onClick={() => onClearPatientFields(patient.id, ['nextVisit'])}>Desfazer ajuste</button>
      </p>}
      <p style={{ ...hint, marginTop: 0 }}>
        Cadastro: {patient.defaultVisitDurationMinutes || 30} min de atendimento e {permanentBuffer} min de folga
        {patient.visitBufferMinutes === undefined ? ' (folga geral da etapa 3).' : ' (folga própria). '}
        {patient.visitBufferMinutes !== undefined && <button type="button" style={inlineLink}
          onClick={() => onClearPatientFields(patient.id, ['visitBufferMinutes'])}>Usar a folga geral ({generalBuffer} min)</button>}
      </p>
    </fieldset>
  );
};

/** Ausência programada (férias, viagem, internação): o paciente não é visitado nesses dias. */
export const AbsenceEditor: React.FC<EditorProps & { workingDays: string[] }> = ({ patient, workingDays, onUpdatePatient, onClearPatientFields }) => {
  const [start, setStart] = useState(workingDays[0] ?? '');
  const [end, setEnd] = useState(workingDays[Math.min(4, workingDays.length - 1)] ?? '');
  const [reason, setReason] = useState('');
  const periods = patient.unavailablePeriods ?? [];
  const valid = Boolean(start && end && end >= start);
  const add = () => {
    if (!valid) return;
    onUpdatePatient(patient.id, current => ({ unavailablePeriods: [...(current.unavailablePeriods ?? []),
      { start, end, kind: 'timeout' as const, ...(reason.trim() ? { reason: reason.trim() } : {}) }] }));
    setReason('');
  };
  const remove = (index: number) => periods.length === 1
    ? onClearPatientFields(patient.id, ['unavailablePeriods'])
    : onUpdatePatient(patient.id, current => ({ unavailablePeriods: (current.unavailablePeriods ?? []).filter((_, item) => item !== index) }));

  return (
    <details open={periods.some(period => period.kind !== 'skip')}>
      <summary style={{ fontSize: 12, fontWeight: 700, cursor: 'pointer', color: '#334155' }}>
        Ausência programada (férias, viagem){periods.length ? ` · ${periods.length}` : ''}
      </summary>
      <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
        {periods.length > 0 && <ul style={{ listStyle: 'none', display: 'grid', gap: 4 }}>
          {periods.map((period, index) => (
            <li key={`${period.start}-${period.end}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, fontSize: 12, background: '#fefce8', borderRadius: 8, padding: '4px 8px' }}>
              <span>{period.kind === 'skip' ? '↷ Retirado da rota' : '🧳 Fora'} {formatShortDate(period.start)}{period.end !== period.start ? ` a ${formatShortDate(period.end)}` : ''}{period.reason ? ` · ${period.reason}` : ''}</span>
              <button type="button" style={{ ...dangerLink, minHeight: 0 }} onClick={() => remove(index)}>Remover</button>
            </li>
          ))}
        </ul>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <div><label style={label} htmlFor="absence-start">De</label>
            <input id="absence-start" style={input} type="date" value={start} onChange={event => setStart(event.target.value)} /></div>
          <div><label style={label} htmlFor="absence-end">Até</label>
            <input id="absence-end" style={input} type="date" min={start} value={end} onChange={event => setEnd(event.target.value)} /></div>
        </div>
        <input aria-label="Motivo da ausência" placeholder="Motivo (ex.: férias, viagem, internação)" style={input} value={reason} onChange={event => setReason(event.target.value)} />
        <button type="button" style={secondaryButton} disabled={!valid} onClick={add}>Adicionar ausência</button>
        <p style={{ ...hint, marginTop: 0 }}>Nesses dias o paciente não entra em nenhuma rota. A visita continua pendente, com o prazo original, e volta depois da ausência.</p>
      </div>
    </details>
  );
};
