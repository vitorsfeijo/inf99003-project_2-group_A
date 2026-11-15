import React, { useRef, useState } from 'react';
import { ImportIssue, Patient, PatientImportContext, PatientImportMode, PatientImportResult, Scenario, parseCsv, patientsFromJson,
  patientsFromTable } from '@routing/core';
import { getImportTemplateUrl, readSpreadsheet } from '../services/api';
import { hint, linkButton, secondaryButton } from './styles';

interface PatientImportProps {
  baseScenario: Scenario | null;
  scenario: Scenario | null;
  disabled?: boolean;
  onImport: (patients: Patient[], mode: PatientImportMode, fileName: string) => void;
}

interface Preview {
  fileName: string;
  result: PatientImportResult;
}

/** CSV salvo pelo Excel em português costuma vir em Windows-1252, não em UTF-8. */
async function readText(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

async function readPatients(file: File, context: PatientImportContext): Promise<PatientImportResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx')) return patientsFromTable((await readSpreadsheet(file)).rows, context);
  if (name.endsWith('.xls')) throw new Error('O formato .xls antigo não é lido. No Excel, use "Salvar como" → "Pasta de Trabalho do Excel (.xlsx)" ou CSV.');
  const text = await readText(file);
  if (name.endsWith('.json')) {
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch (error) {
      throw new Error(`O JSON está mal formado: ${error instanceof Error ? error.message : String(error)}`);
    }
    return patientsFromJson(value, context);
  }
  if (name.endsWith('.csv') || name.endsWith('.txt') || name.endsWith('.tsv')) return patientsFromTable(parseCsv(text), context);
  throw new Error('Formato não reconhecido. Use .xlsx, .csv ou .json.');
}

const IssueList: React.FC<{ issues: ImportIssue[]; color: string }> = ({ issues, color }) => (
  <ul style={{ margin: '4px 0 0', paddingLeft: 16, maxHeight: 140, overflowY: 'auto', fontSize: 11, lineHeight: 1.45, color }}>
    {issues.slice(0, 200).map((issue, index) => <li key={index}><strong>{issue.where}:</strong> {issue.message}</li>)}
    {issues.length > 200 && <li>… e mais {issues.length - 200}.</li>}
  </ul>
);

const plural = (count: number, singular: string, pluralForm: string) => `${count} ${count === 1 ? singular : pluralForm}`;

export const PatientImport: React.FC<PatientImportProps> = ({ baseScenario, scenario, disabled, onImport }) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [isReading, setIsReading] = useState(false);
  const [mode, setMode] = useState<PatientImportMode>('add');
  const target = scenario ?? baseScenario;
  const currentCount = scenario?.patients.length ?? 0;

  const handleFile = async (file: File | undefined) => {
    if (!file || !target) return;
    setError('');
    setPreview(null);
    setIsReading(true);
    try {
      const context: PatientImportContext = {
        healthCenter: target.healthCenter, polygons: target.polygons, teams: target.teams, startDate: target.startDate,
        existingPatients: scenario?.patients ?? []
      };
      setPreview({ fileName: file.name, result: await readPatients(file, context) });
      setMode('add');
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : String(readError));
    } finally {
      setIsReading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const apply = () => {
    if (!preview) return;
    if (mode === 'replace' && currentCount
      && !window.confirm(`Substituir os ${currentCount} pacientes atuais pelos ${preview.result.patients.length} do arquivo? Os planos gerados deixam de valer.`)) return;
    onImport(preview.result.patients, mode, preview.fileName);
    setPreview(null);
  };

  const result = preview?.result;
  const conditionCount = result?.patients.reduce((sum, patient) => sum + patient.conditions.length, 0) ?? 0;
  const updates = result && scenario
    ? result.patients.filter(patient => scenario.patients.some(current => current.code.trim().toLowerCase() === patient.code.trim().toLowerCase())).length
    : 0;

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
      <input ref={fileInput} id="patient-import-file" type="file" accept=".xlsx,.csv,.txt,.tsv,.json" hidden
        onChange={event => void handleFile(event.target.files?.[0])} />
      <button type="button" disabled={!target || disabled || isReading} onClick={() => fileInput.current?.click()}
        style={{ ...secondaryButton, background: '#f1f5f9', color: '#0f172a', cursor: target ? 'pointer' : 'not-allowed' }}>
        {isReading ? 'Lendo arquivo…' : 'Importar pacientes (Excel, CSV ou JSON)'}
      </button>
      <p style={hint}>
        Baixe o modelo em <a href={getImportTemplateUrl('xlsx', target)} style={{ ...linkButton, padding: 0, fontSize: 11 }} download>Excel</a>
        {' ou '}<a href={getImportTemplateUrl('csv', target)} style={{ ...linkButton, padding: 0, fontSize: 11 }} download>CSV</a>.
        {' '}Uma linha por condição; repetir o código soma outra condição ao mesmo paciente.
      </p>
      {error && <p role="alert" style={{ fontSize: 12, color: '#b91c1c', marginTop: 6 }}>{error}</p>}
      {preview && result && (
        <div role="region" aria-label="Prévia da importação" style={{ marginTop: 8, padding: 10, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 12, color: '#334155' }}>
          <p>
            <strong>{preview.fileName}</strong>: {plural(result.patients.length, 'paciente pronto', 'pacientes prontos')}
            {' '}({plural(conditionCount, 'condição', 'condições')})
            {result.errors.length > 0 && <>, <span style={{ color: '#b91c1c', fontWeight: 700 }}>{plural(result.errors.length, 'linha recusada', 'linhas recusadas')}</span></>}
            {updates > 0 && `; ${plural(updates, 'já cadastrado será atualizado', 'já cadastrados serão atualizados')}`}.
          </p>
          {result.errors.length > 0 && <details open style={{ marginTop: 6 }}><summary style={{ cursor: 'pointer', fontWeight: 700, color: '#b91c1c' }}>O que precisa ser corrigido</summary><IssueList issues={result.errors} color="#991b1b" /></details>}
          {result.warnings.length > 0 && <details style={{ marginTop: 6 }}><summary style={{ cursor: 'pointer', fontWeight: 700, color: '#92400e' }}>Avisos ({result.warnings.length})</summary><IssueList issues={result.warnings} color="#78350f" /></details>}
          {currentCount > 0 && result.patients.length > 0 && (
            <fieldset style={{ border: 'none', marginTop: 8, display: 'grid', gap: 4 }}>
              <legend style={{ fontWeight: 700, marginBottom: 2 }}>E os {currentCount} pacientes atuais?</legend>
              <label><input type="radio" name="import-mode" checked={mode === 'add'} onChange={() => setMode('add')} /> Manter e somar os do arquivo</label>
              <label><input type="radio" name="import-mode" checked={mode === 'replace'} onChange={() => setMode('replace')} /> Substituir pelos do arquivo</label>
            </fieldset>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" disabled={!result.patients.length} onClick={apply}
              style={{ ...secondaryButton, background: result.patients.length ? '#2563eb' : '#cbd5e1', color: 'white' }}>
              Importar {plural(result.patients.length, 'paciente', 'pacientes')}
            </button>
            <button type="button" onClick={() => setPreview(null)} style={{ ...secondaryButton, background: 'transparent', color: '#475569', width: 'auto' }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
};
