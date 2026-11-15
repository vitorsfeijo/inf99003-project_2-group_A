import { FastifyInstance } from 'fastify';
import { PATIENT_IMPORT_COLUMNS, PROFESSIONS, TableCell, patientImportTemplate } from '@routing/core';
import { buildXlsx, XLSX_CONTENT_TYPE } from '../export/xlsx.js';
import { readXlsx, SpreadsheetError } from '../import/xlsx-reader.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
// Centro de Porto Alegre: usado quando o modelo é pedido sem unidade escolhida.
const DEFAULT_CENTER = { lat: -30.0346, lng: -51.2177 };

function templateRows(query: { lat?: string; lng?: string; startDate?: string }): TableCell[][] {
  const lat = Number(query.lat);
  const lng = Number(query.lng);
  const center = Number.isFinite(lat) && Number.isFinite(lng) && query.lat && query.lng ? { lat, lng } : DEFAULT_CENTER;
  const startDate = query.startDate && DATE.test(query.startDate) ? query.startDate : new Date().toISOString().slice(0, 10);
  return patientImportTemplate(center, startDate);
}

/** CSV no padrão do Excel em português: ";" como separador e vírgula decimal. */
function toBrazilianCsv(rows: TableCell[][]): string {
  const cell = (value: TableCell) => {
    const text = typeof value === 'number' ? String(value).replace('.', ',') : String(value ?? '');
    return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return `﻿${rows.map(row => row.map(cell).join(';')).join('\r\n')}\r\n`;
}

export async function registerImportRoutes(fastify: FastifyInstance) {
  // Converte um .xlsx em linhas; a interpretação dos pacientes fica no @routing/core, no navegador.
  fastify.post<{ Body: { fileName?: string; contentBase64?: string } }>('/api/import/table', async (request, reply) => {
    const { fileName, contentBase64 } = request.body ?? {};
    if (typeof contentBase64 !== 'string' || !contentBase64) {
      return reply.status(400).send({ error: 'Envie o arquivo em "contentBase64".' });
    }
    if (fileName && !/\.xlsx$/i.test(fileName)) {
      return reply.status(400).send({ error: `O servidor lê apenas planilhas .xlsx (recebido: ${fileName}). CSV e JSON são lidos no navegador.` });
    }
    const buffer = Buffer.from(contentBase64, 'base64');
    try {
      return readXlsx(buffer);
    } catch (error) {
      if (error instanceof SpreadsheetError) return reply.status(400).send({ error: error.message });
      request.log.error(error);
      return reply.status(400).send({ error: `Não foi possível ler a planilha: ${error instanceof Error ? error.message : String(error)}` });
    }
  });

  fastify.get<{ Querystring: { lat?: string; lng?: string; startDate?: string } }>('/api/import/template.xlsx', async (request, reply) => {
    const rows = templateRows(request.query);
    const instructions: TableCell[][] = [
      ['Coluna', 'Obrigatória', 'O que preencher'],
      ...PATIENT_IMPORT_COLUMNS.map(column => [column.header, column.required ? 'sim' : 'não', column.description]),
      [],
      ['Dica', '', 'Uma linha por condição acompanhada. Os exemplos da aba Pacientes ficam perto do posto: apague-os antes de importar.'],
      ['Dica', '', 'Datas: AAAA-MM-DD ou DD/MM/AAAA (células de data do Excel também valem). Coordenadas em graus decimais.']
    ];
    const categories: TableCell[][] = [['Código', 'Categoria'], ...PROFESSIONS.map(profession => [profession.id, profession.label])];
    reply.header('Content-Type', XLSX_CONTENT_TYPE);
    reply.header('Content-Disposition', 'attachment; filename="modelo_pacientes.xlsx"');
    return reply.send(buildXlsx([
      { name: 'Pacientes', rows },
      { name: 'Instruções', rows: instructions, columnWidths: [20, 12, 110] },
      { name: 'Categorias', rows: categories }
    ]));
  });

  fastify.get<{ Querystring: { lat?: string; lng?: string; startDate?: string } }>('/api/import/template.csv', async (request, reply) => {
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', 'attachment; filename="modelo_pacientes.csv"');
    return reply.send(toBrazilianCsv(templateRows(request.query)));
  });
}
