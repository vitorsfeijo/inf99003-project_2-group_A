import React from 'react';
import { PROFESSIONS, ProfessionId, Scenario, Team, professionCount, professionLabel, teamProfessions, teamStaffCount } from '@routing/core';
import { chip, dangerLink, hint, input, label, secondaryButton } from './styles';

interface TeamEditorProps {
  scenario: Scenario;
  disabled: boolean;
  // Atualizações funcionais: cliques seguidos sempre partem da lista mais recente.
  onChangeTeams: (update: (teams: Team[]) => Team[]) => void;
  onChangeRules: (rules: Partial<Pick<Scenario, 'visitBufferMinutes' | 'deadlineSafetyMarginDays'>>) => void;
}

function toggle(list: string[], item: string): string[] {
  return list.includes(item) ? list.filter(value => value !== item) : [...list, item];
}

/** Guarda só as contagens acima de 1 e das categorias presentes; o padrão é 1 por categoria. */
function withCount(team: Team, profession: ProfessionId, count: number | null): Partial<Team> {
  const professions = teamProfessions(team);
  const counts: Partial<Record<ProfessionId, number>> = {};
  for (const [id, value] of Object.entries(team.professionCounts ?? {})) {
    if (id !== profession && professions.includes(id) && value && value > 1) counts[id] = value;
  }
  if (count && count > 1 && professions.includes(profession)) counts[profession] = count;
  return { professionCounts: Object.keys(counts).length ? counts : undefined };
}

/** Equipes que saem para as visitas, suas categorias profissionais e as folgas do planejamento. */
export const TeamEditor: React.FC<TeamEditorProps> = ({ scenario, disabled, onChangeTeams, onChangeRules }) => {
  const updateTeam = (teamId: string, update: (team: Team) => Partial<Team>) =>
    onChangeTeams(teams => teams.map(team => team.id === teamId ? { ...team, ...update(team) } : team));
  const addTeam = () => onChangeTeams(teams => {
    let index = teams.length + 1;
    while (teams.some(team => team.id === `team_${index}`)) index++;
    return [...teams, { id: `team_${index}`, name: `Equipe ${String.fromCharCode(64 + Math.min(index, 26))}`,
      professions: ['acs'], dailyWorkMinutes: 240, availableDays: [] }];
  });
  const removeTeam = (teamId: string) => {
    const linked = scenario.patients.filter(patient => patient.assignedTeamId === teamId).length;
    if (linked && !window.confirm(`${linked} paciente(s) estão vinculados a esta equipe e voltarão a aceitar qualquer equipe. Remover?`)) return;
    onChangeTeams(teams => teams.filter(team => team.id !== teamId));
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {scenario.teams.map(team => {
        const professions = teamProfessions(team);
        return (
          <fieldset key={team.id} disabled={disabled} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, display: 'grid', gap: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 96px', gap: 8 }}>
              <div><label htmlFor={`team-name-${team.id}`} style={label}>Equipe</label>
                <input id={`team-name-${team.id}`} style={input} value={team.name} onChange={event => { const name = event.target.value; updateTeam(team.id, () => ({ name })); }} /></div>
              <div><label htmlFor={`team-minutes-${team.id}`} style={label}>Jornada (min)</label>
                <input id={`team-minutes-${team.id}`} style={input} type="number" min={30} max={720} step={10} value={team.dailyWorkMinutes}
                  onChange={event => { const minutes = Math.max(30, Number(event.target.value) || 0); updateTeam(team.id, () => ({ dailyWorkMinutes: minutes })); }} /></div>
            </div>
            <span style={label}>Profissionais da equipe</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {PROFESSIONS.map(profession => (
                <button key={profession.id} type="button" aria-pressed={professions.includes(profession.id)}
                  style={chip(professions.includes(profession.id))}
                  onClick={() => updateTeam(team.id, current => {
                    const next = { ...current, professions: toggle(teamProfessions(current), profession.id) };
                    return { professions: next.professions, ...withCount(next, profession.id, professionCount(current, profession.id) || null) };
                  })}>
                  {profession.label}
                </button>
              ))}
            </div>
            {professions.length > 0 && <div style={{ display: 'grid', gap: 5 }}>
              <span style={{ ...label, marginBottom: 0 }}>Quantos profissionais de cada categoria</span>
              {professions.map(profession => (
                <div key={profession} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label htmlFor={`team-count-${team.id}-${profession}`} style={{ flex: 1, fontSize: 12, color: '#334155' }}>{professionLabel(profession)}</label>
                  <input id={`team-count-${team.id}-${profession}`} style={{ ...input, width: 68, minHeight: 32, padding: '4px 8px' }} type="number" min={1} max={20} step={1}
                    value={professionCount(team, profession)}
                    onChange={event => { const count = Math.min(20, Math.max(1, Math.floor(Number(event.target.value)) || 1)); updateTeam(team.id, current => withCount(current, profession, count)); }} />
                </div>
              ))}
              <p style={{ ...hint, marginTop: 0 }}>{teamStaffCount(team)} profissional(is) saem juntos nesta equipe. Pacientes que exigem mais pessoas não são atribuídos a ela.</p>
            </div>}
            {!professions.length && <p style={{ ...hint, color: '#92400e' }}>Sem categorias: a equipe só recebe visitas sem exigência profissional.</p>}
            {scenario.teams.length > 1 && <button type="button" style={{ ...dangerLink, justifySelf: 'start' }} onClick={() => removeTeam(team.id)}>Remover equipe</button>}
          </fieldset>
        );
      })}
      <button type="button" disabled={disabled} style={secondaryButton} onClick={addTeam}>+ Adicionar equipe</button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
        <div><label htmlFor="visit-buffer" style={label}>Folga após cada visita (min)</label>
          <input id="visit-buffer" style={input} type="number" min={0} max={120} step={5} disabled={disabled}
            value={scenario.visitBufferMinutes ?? 0}
            onChange={event => onChangeRules({ visitBufferMinutes: Math.min(120, Math.max(0, Number(event.target.value) || 0)) })} /></div>
        <div><label htmlFor="safety-margin" style={label}>Margem nos prazos (dias)</label>
          <input id="safety-margin" style={input} type="number" min={0} max={14} step={1} disabled={disabled}
            value={scenario.deadlineSafetyMarginDays ?? 0}
            onChange={event => onChangeRules({ deadlineSafetyMarginDays: Math.min(14, Math.max(0, Number(event.target.value) || 0)) })} /></div>
      </div>
      <p style={hint}>A folga reserva tempo livre depois de cada visita para imprevistos (visita que demora mais, chuva, espera). A margem planeja cada visita alguns dias antes do prazo, para que uma ausência ainda possa ser recuperada a tempo.</p>
    </div>
  );
};
