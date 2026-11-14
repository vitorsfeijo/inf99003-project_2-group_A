import React, { useEffect, useMemo, useState } from 'react';
import { Patient, PROFESSIONS, Scenario, getWorkingDaysHorizon, isPointInAnyPolygon, professionLabel, requiredProfessionCount,
  requiredProfessionIds, requiredStaffCount, teamCanServe, teamStaffCount, unavailablePeriodOn } from '@routing/core';
import { AbsenceEditor, VisitTimesEditor } from './PatientScheduleEditors';
import { BaseRegionSummary } from '../services/api';
import { badge, chip, dangerLink, hint, input, label, linkButton, secondaryButton } from './styles';

interface PatientPanelProps {
  scenario: Scenario | null;
  regions: BaseRegionSummary[];
  currentRegionId: string;
  selectedPatientId: string | null;
  isAddingPatient: boolean;
  onSelectPatient: (patientId: string | null) => void;
  onUpdatePatient: (patientId: string, patch: Partial<Patient> | ((patient: Patient) => Partial<Patient>)) => void;
  onClearPatientFields: (patientId: string, fields: (keyof Patient)[]) => void;
  onRemovePatient: (patientId: string) => void;
  onTransferPatient: (patientId: string, toRegionId: string, reason: string) => Promise<void>;
  onToggleAddPatient: () => void;
}

type DeadlineMode = 'none' | 'anchor' | 'days' | 'date';

/** Etiquetas que resumem as restrições de um paciente. */
export function patientBadges(patient: Patient, scenario: Scenario): { text: string; style: React.CSSProperties; title: string }[] {
  const items: { text: string; style: React.CSSProperties; title: string }[] = [];
  if (patient.transfer) {
    items.push({ text: `→ ${patient.transfer.toHealthCenterName}`, style: badge('#475569', '#e2e8f0'), title: 'Transferido para outra unidade' });
    return items;
  }
  if (patient.hardDeadline) {
    const anchor = patient.hardDeadline <= scenario.startDate;
    items.push({ text: anchor ? '⚓ Âncora' : `⏱ até ${formatDate(patient.hardDeadline)}`, style: badge('#9a3412', '#ffedd5'),
      title: anchor ? 'Deve entrar na rota do primeiro dia' : 'Prazo rígido' });
  }
  for (const profession of requiredProfessionIds(patient)) {
    const count = requiredProfessionCount(patient, profession);
    items.push({ text: `${count > 1 ? `${count}× ` : ''}${professionLabel(profession).replace(/ \(.*\)$/, '')}`, style: badge('#1e3a8a', '#dbeafe'), title: 'Categoria exigida' });
  }
  const away = (patient.unavailablePeriods ?? []).find(period => period.kind !== 'skip' && period.end >= scenario.startDate);
  if (away) {
    const now = unavailablePeriodOn(patient, scenario.startDate);
    items.push({ text: now ? `🧳 fora até ${formatDate(away.end)}` : `🧳 ${formatDate(away.start)}–${formatDate(away.end)}`,
      style: badge('#854d0e', '#fef9c3'), title: `Ausência programada${away.reason ? `: ${away.reason}` : ''}` });
  }
  if (patient.nextVisit) {
    items.push({ text: '⏱ ajuste na próxima visita', style: badge('#854d0e', '#fef9c3'), title: 'Duração ou folga só da próxima visita' });
  }
  if (patient.visitBufferMinutes !== undefined) {
    items.push({ text: `folga ${patient.visitBufferMinutes} min`, style: badge('#334155', '#e2e8f0'), title: 'Folga própria do paciente' });
  }
  if (requiredStaffCount(patient) > 1) {
    items.push({ text: `👥 ${requiredStaffCount(patient)} profissionais`, style: badge('#1e3a8a', '#dbeafe'), title: 'Profissionais necessários na visita (ex.: mobilizar paciente acamado)' });
  }
  if (patient.assignedTeamId) {
    const team = scenario.teams.find(item => item.id === patient.assignedTeamId);
    items.push({ text: `Vínculo: ${team?.name ?? patient.assignedTeamId}`, style: badge('#166534', '#dcfce7'), title: 'Só esta equipe visita o paciente' });
  }
  const inside = isPointInAnyPolygon(patient.location, scenario.polygons);
  if (!inside) {
    items.push(patient.territoryOverride === 'include'
      ? { text: 'Incluído fora do contorno', style: badge('#6b21a8', '#f3e8ff'), title: 'Pertence à unidade apesar do contorno do GeoSaúde' }
      : { text: 'Fora do território', style: badge('#991b1b', '#fee2e2'), title: 'Não entra no planejamento' });
  }
  return items;
}

function formatDate(date: string): string {
  const [, month, day] = date.split('-');
  return `${day}/${month}`;
}

export const PatientPanel: React.FC<PatientPanelProps> = props => {
  const { scenario } = props;
  const [filter, setFilter] = useState('');
  const [onlyRestricted, setOnlyRestricted] = useState(false);
  const patients = useMemo(() => (scenario?.patients ?? []).filter(patient => {
    const matches = !filter || patient.code.toLowerCase().includes(filter.toLowerCase());
    const restricted = Boolean(patient.hardDeadline || requiredProfessionIds(patient).length || requiredStaffCount(patient) > 1 || patient.assignedTeamId
      || patient.transfer || patient.territoryOverride || patient.unavailablePeriods?.length || patient.nextVisit || patient.visitBufferMinutes !== undefined);
    return matches && (!onlyRestricted || restricted);
  }), [scenario, filter, onlyRestricted]);

  if (!scenario) return <p style={{ color: '#64748b', textAlign: 'center', marginTop: '2rem' }}>Amostre pacientes para editar o cadastro.</p>;
  const selected = scenario.patients.find(patient => patient.id === props.selectedPatientId) ?? null;

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <button type="button" style={{ ...secondaryButton, background: props.isAddingPatient ? '#fde68a' : '#e0e7ff', color: props.isAddingPatient ? '#92400e' : '#1e40af' }}
        onClick={props.onToggleAddPatient}>
        {props.isAddingPatient ? 'Clique no mapa para posicionar · cancelar' : '+ Cadastrar paciente no mapa'}
      </button>
      {selected && <PatientEditor key={selected.id} patient={selected} {...props} scenario={scenario} />}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input aria-label="Buscar paciente pelo código" placeholder="Buscar código" style={{ ...input, minHeight: 34 }} value={filter} onChange={event => setFilter(event.target.value)} />
        <label style={{ fontSize: 12, display: 'flex', gap: 4, alignItems: 'center', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={onlyRestricted} onChange={event => setOnlyRestricted(event.target.checked)} /> Com restrições
        </label>
      </div>
      <ul style={{ listStyle: 'none', display: 'grid', gap: 6 }}>
        {patients.map(patient => (
          <li key={patient.id}>
            <button type="button" onClick={() => props.onSelectPatient(patient.id === props.selectedPatientId ? null : patient.id)}
              style={{ width: '100%', textAlign: 'left', border: `1px solid ${patient.id === props.selectedPatientId ? '#2563eb' : '#e2e8f0'}`,
                background: patient.transfer ? '#f8fafc' : '#fff', borderRadius: 8, padding: '7px 9px', cursor: 'pointer', opacity: patient.transfer ? .7 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                <strong style={{ fontSize: 13 }}>{patient.code}</strong>
                <span style={{ fontSize: 11, color: '#64748b' }}>prioridade {patient.conditions[0]?.priorityWeight ?? '–'}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                {patientBadges(patient, scenario).map(item => <span key={item.text} title={item.title} style={item.style}>{item.text}</span>)}
              </div>
            </button>
          </li>
        ))}
        {!patients.length && <li style={{ fontSize: 12, color: '#94a3b8' }}>Nenhum paciente encontrado.</li>}
      </ul>
    </div>
  );
};

const PatientEditor: React.FC<PatientPanelProps & { patient: Patient; scenario: Scenario }> = props => {
  const { patient, scenario } = props;
  const workingDays = useMemo(() => getWorkingDaysHorizon(scenario.startDate, Math.max(1, scenario.planningHorizonDays)), [scenario.startDate, scenario.planningHorizonDays]);
  const initialMode: DeadlineMode = !patient.hardDeadline ? 'none' : patient.hardDeadline <= workingDays[0] ? 'anchor' : 'date';
  const [mode, setMode] = useState<DeadlineMode>(initialMode);
  const [days, setDays] = useState(3);
  const [transferTarget, setTransferTarget] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  useEffect(() => setMode(initialMode), [patient.hardDeadline]);

  const condition = patient.conditions[0];
  const inside = isPointInAnyPolygon(patient.location, scenario.polygons);
  const required = requiredProfessionIds(patient);
  const staff = requiredStaffCount(patient);
  const compatibleTeams = scenario.teams.filter(team => teamCanServe(team, patient));
  const restrictsTeams = required.length > 0 || staff > 1;
  const setStaff = (value: number) => value > 1
    ? props.onUpdatePatient(patient.id, { requiredStaffCount: value })
    : props.onClearPatientFields(patient.id, ['requiredStaffCount']);
  const setProfessionCount = (profession: string, value: number) => props.onUpdatePatient(patient.id, current => {
    const counts = { ...(current.requiredProfessionCounts ?? {}) };
    if (value > 1) counts[profession] = value;
    else delete counts[profession];
    return { requiredProfessionCounts: Object.keys(counts).length ? counts : undefined };
  });

  const setDeadline = (next: DeadlineMode, value?: string) => {
    setMode(next);
    if (next === 'none') props.onClearPatientFields(patient.id, ['hardDeadline']);
    else if (next === 'anchor') props.onUpdatePatient(patient.id, { hardDeadline: workingDays[0] });
    else if (next === 'days') props.onUpdatePatient(patient.id, { hardDeadline: workingDays[Math.min(workingDays.length, Math.max(1, value ? Number(value) : days)) - 1] });
    else if (value) props.onUpdatePatient(patient.id, { hardDeadline: value });
  };
  const toggleProfession = (profession: string) => props.onUpdatePatient(patient.id, current => {
    const list = requiredProfessionIds(current);
    const removing = list.includes(profession);
    const next = removing ? list.filter(item => item !== profession) : [...list, profession];
    const counts = { ...(current.requiredProfessionCounts ?? {}) };
    if (removing) delete counts[profession];
    return { requiredProfessions: next.length ? next : undefined, requiredProfessionCounts: Object.keys(counts).length ? counts : undefined };
  });
  const updateCondition = (patch: Partial<typeof condition>) => props.onUpdatePatient(patient.id, current => ({
    conditions: current.conditions.map((item, index) => index === 0 ? { ...item, ...patch } : item)
  }));
  const transfer = async () => {
    const region = props.regions.find(item => item.id === transferTarget);
    if (!region || !window.confirm(`Transferir ${patient.code} para ${region.name}? Ele sairá do planejamento desta unidade.`)) return;
    setIsTransferring(true);
    try {
      await props.onTransferPatient(patient.id, transferTarget, transferReason.trim());
    } finally {
      setIsTransferring(false);
    }
  };

  if (patient.transfer) {
    return (
      <section aria-label={`Paciente ${patient.code}`} style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: 10, background: '#f8fafc' }}>
        <strong>{patient.code}</strong>
        <p style={hint}>Transferido para {patient.transfer.toHealthCenterName} em {formatDate(patient.transfer.date)}{patient.transfer.reason ? ` · ${patient.transfer.reason}` : ''}. Ele aparece para aquela unidade ao amostrar o território dela.</p>
        <button type="button" style={linkButton} onClick={() => props.onSelectPatient(null)}>Fechar</button>
      </section>
    );
  }

  return (
    <section aria-label={`Editar paciente ${patient.code}`} style={{ border: '2px solid #2563eb', borderRadius: 10, padding: 10, display: 'grid', gap: 10, background: '#f8fbff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 15 }}>{patient.code}</strong>
        <button type="button" style={linkButton} onClick={() => props.onSelectPatient(null)}>Fechar</button>
      </div>

      {condition && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <div><label style={label} htmlFor="patient-weight">Prioridade (1–5)</label>
          <input id="patient-weight" style={input} type="number" min={1} max={5} value={condition.priorityWeight}
            onChange={event => updateCondition({ priorityWeight: Math.min(5, Math.max(1, Number(event.target.value) || 1)) })} /></div>
        <div><label style={label} htmlFor="patient-interval">Intervalo (dias)</label>
          <input id="patient-interval" style={input} type="number" min={1} max={365} value={condition.maxIntervalDays}
            onChange={event => updateCondition({ maxIntervalDays: Math.max(1, Number(event.target.value) || 1) })} /></div>
      </div>}

      <VisitTimesEditor {...props} />

      <div>
        <label style={label} htmlFor="patient-deadline">Prazo rígido (acima da prioridade)</label>
        <select id="patient-deadline" style={input} value={mode} onChange={event => setDeadline(event.target.value as DeadlineMode, event.target.value === 'date' ? workingDays[Math.min(2, workingDays.length - 1)] : undefined)}>
          <option value="none">Sem prazo rígido</option>
          <option value="anchor">Âncora: obrigatório na rota de {formatDate(workingDays[0])}</option>
          <option value="days">Em até N dias úteis</option>
          <option value="date">Até uma data</option>
        </select>
        {mode === 'days' && <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
          <input aria-label="Número de dias úteis" style={{ ...input, width: 80 }} type="number" min={1} max={workingDays.length} value={days}
            onChange={event => { const value = Math.min(workingDays.length, Math.max(1, Number(event.target.value) || 1)); setDays(value); setDeadline('days', String(value)); }} />
          <span style={{ fontSize: 12, color: '#334155' }}>dias úteis → até {patient.hardDeadline ? formatDate(patient.hardDeadline) : '—'}</span>
        </div>}
        {mode === 'date' && <input aria-label="Data limite" style={{ ...input, marginTop: 6 }} type="date" min={workingDays[0]} value={patient.hardDeadline ?? ''}
          onChange={event => event.target.value && setDeadline('date', event.target.value)} />}
        <p style={hint}>Diferente da prioridade, o prazo rígido é obrigatório: o plano abre espaço retirando visitas menos prioritárias e avisa se for impossível cumprir.</p>
      </div>

      <div>
        <span style={label}>Categorias exigidas na visita</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {PROFESSIONS.map(profession => <button key={profession.id} type="button" aria-pressed={required.includes(profession.id)}
            style={chip(required.includes(profession.id))} onClick={() => toggleProfession(profession.id)}>{profession.label}</button>)}
        </div>
        {required.length > 0 && <div style={{ display: 'grid', gap: 5, marginTop: 8 }}>
          <span style={{ ...label, marginBottom: 0 }}>Quantos de cada categoria</span>
          {required.map(profession => (
            <div key={profession} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label htmlFor={`patient-count-${profession}`} style={{ flex: 1, fontSize: 12, color: '#334155' }}>{professionLabel(profession)}</label>
              <input id={`patient-count-${profession}`} style={{ ...input, width: 68, minHeight: 32, padding: '4px 8px' }} type="number" min={1} max={10} step={1}
                value={requiredProfessionCount(patient, profession)}
                onChange={event => setProfessionCount(profession, Math.min(10, Math.max(1, Math.floor(Number(event.target.value)) || 1)))} />
            </div>
          ))}
        </div>}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <label htmlFor="patient-staff" style={{ ...label, marginBottom: 0, flex: 1 }}>Profissionais necessários na visita (total)</label>
          <input id="patient-staff" style={{ ...input, width: 72 }} type="number" min={1} max={10} step={1} value={staff}
            onChange={event => setStaff(Math.min(10, Math.max(1, Math.floor(Number(event.target.value)) || 1)))} />
        </div>
        <p style={hint}>{restrictsTeams
          ? `A equipe da visita precisa ${[required.length ? `reunir ${required.map(profession => `${requiredProfessionCount(patient, profession) > 1 ? `${requiredProfessionCount(patient, profession)}× ` : ''}${professionLabel(profession).replace(/ \(.*\)$/, '')}`).join(', ')}` : '', staff > 1 ? `ter pelo menos ${staff} profissionais no total` : ''].filter(Boolean).join(' e ')}. ${compatibleTeams.length
            ? `Compatíveis: ${compatibleTeams.map(team => `${team.name} (${teamStaffCount(team)})`).join(', ')}.`
            : 'Nenhuma equipe atual atende — ajuste as equipes na etapa 3.'}`
          : 'Sem exigência: qualquer equipe (inclusive um ACS sozinho) pode fazer a visita. Use 2 ou mais profissionais para, por exemplo, mobilizar um paciente acamado.'}</p>
      </div>

      <div>
        <label style={label} htmlFor="patient-team">Equipe responsável</label>
        <select id="patient-team" style={input} value={patient.assignedTeamId ?? ''}
          onChange={event => event.target.value ? props.onUpdatePatient(patient.id, { assignedTeamId: event.target.value }) : props.onClearPatientFields(patient.id, ['assignedTeamId'])}>
          <option value="">Qualquer equipe compatível</option>
          {scenario.teams.map(team => <option key={team.id} value={team.id}>Sempre {team.name}</option>)}
        </select>
      </div>

      <AbsenceEditor {...props} workingDays={workingDays} />

      {!inside && <label style={{ display: 'flex', gap: 6, fontSize: 12, alignItems: 'flex-start' }}>
        <input type="checkbox" checked={patient.territoryOverride === 'include'}
          onChange={event => event.target.checked ? props.onUpdatePatient(patient.id, { territoryOverride: 'include' }) : props.onClearPatientFields(patient.id, ['territoryOverride'])} />
        Está fora do contorno do GeoSaúde, mas pertence a esta unidade (microárea desenhada incorretamente).
      </label>}

      <details>
        <summary style={{ fontSize: 12, fontWeight: 700, cursor: 'pointer', color: '#334155' }}>Transferir para outra unidade</summary>
        <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
          <select aria-label="Unidade de destino" style={input} value={transferTarget} onChange={event => setTransferTarget(event.target.value)}>
            <option value="">Escolha a unidade de destino</option>
            {props.regions.filter(region => region.id !== props.currentRegionId).map(region => <option key={region.id} value={region.id}>{region.name}</option>)}
          </select>
          <input aria-label="Motivo da transferência" placeholder="Motivo (ex.: endereço pertence à US vizinha)" style={input} value={transferReason} onChange={event => setTransferReason(event.target.value)} />
          <button type="button" style={secondaryButton} disabled={!transferTarget || isTransferring} onClick={transfer}>{isTransferring ? 'Transferindo…' : 'Transferir paciente'}</button>
        </div>
      </details>

      <button type="button" style={{ ...dangerLink, justifySelf: 'start' }}
        onClick={() => window.confirm(`Remover ${patient.code} do cenário?`) && props.onRemovePatient(patient.id)}>Remover paciente</button>
    </section>
  );
};
