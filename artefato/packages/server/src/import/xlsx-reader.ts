/**
 * Leitor mínimo de planilhas Excel (.xlsx) sem dependências externas: abre o ZIP com o zlib do Node
 * e lê a primeira aba visível. Devolve as linhas na numeração do Excel (a linha 1 é o índice 0),
 * para que as mensagens de erro apontem a linha certa. Células formatadas como data viram AAAA-MM-DD.
 */
import { inflateRawSync } from 'node:zlib';

export type ReadCell = string | number | boolean | null;

export interface XlsxTable {
  sheetName: string;
  rows: ReadCell[][];
}

const MAX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024;

export class SpreadsheetError extends Error {}

// --- ZIP ---

function unzip(buffer: Buffer): Map<string, Buffer> {
  if (buffer.length >= 4 && buffer.readUInt32LE(0) === 0xE011CFD0) {
    throw new SpreadsheetError('Este arquivo é do formato antigo do Excel (.xls) ou está protegido por senha. Salve como "Pasta de Trabalho do Excel (.xlsx)" ou CSV e tente de novo.');
  }
  if (buffer.length < 22 || buffer.readUInt32LE(0) !== 0x04034B50) {
    throw new SpreadsheetError('O arquivo não é uma planilha .xlsx válida.');
  }
  let end = -1;
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65557); offset--) {
    if (buffer.readUInt32LE(offset) === 0x06054B50) { end = offset; break; }
  }
  if (end < 0) throw new SpreadsheetError('A planilha .xlsx está incompleta ou corrompida (fim do arquivo não encontrado).');
  const count = buffer.readUInt16LE(end + 10);
  let pointer = buffer.readUInt32LE(end + 16);
  const files = new Map<string, Buffer>();
  let total = 0;
  for (let index = 0; index < count; index++) {
    if (buffer.readUInt32LE(pointer) !== 0x02014B50) throw new SpreadsheetError('A planilha .xlsx está corrompida (diretório do ZIP inválido).');
    const flags = buffer.readUInt16LE(pointer + 8);
    const method = buffer.readUInt16LE(pointer + 10);
    const compressedSize = buffer.readUInt32LE(pointer + 20);
    const size = buffer.readUInt32LE(pointer + 24);
    const nameLength = buffer.readUInt16LE(pointer + 28);
    const extraLength = buffer.readUInt16LE(pointer + 30);
    const commentLength = buffer.readUInt16LE(pointer + 32);
    const localOffset = buffer.readUInt32LE(pointer + 42);
    const name = buffer.toString('utf8', pointer + 46, pointer + 46 + nameLength);
    pointer += 46 + nameLength + extraLength + commentLength;
    if (flags & 1) throw new SpreadsheetError('A planilha está protegida por senha. Remova a senha e tente de novo.');
    if (compressedSize === 0xFFFFFFFF || localOffset === 0xFFFFFFFF) throw new SpreadsheetError('A planilha é grande demais para importar (ZIP64).');
    total += size;
    if (total > MAX_UNCOMPRESSED_BYTES) throw new SpreadsheetError('A planilha descompactada passa de 200 MB; divida o arquivo.');
    const dataStart = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
    const data = buffer.subarray(dataStart, dataStart + compressedSize);
    if (method === 0) files.set(name, data);
    else if (method === 8) files.set(name, inflateRawSync(data, { maxOutputLength: Math.max(size, 1) }));
    else throw new SpreadsheetError(`A planilha usa uma compressão não suportada (método ${method}).`);
  }
  return files;
}

// --- XML ---

function decodeXml(value: string): string {
  return value
    .replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, (_, entity: string) => {
      if (entity === 'lt') return '<';
      if (entity === 'gt') return '>';
      if (entity === 'amp') return '&';
      if (entity === 'quot') return '"';
      if (entity === 'apos') return "'";
      return String.fromCodePoint(entity[1] === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10));
    })
    .replace(/_x([0-9a-fA-F]{4})_/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

function attribute(tag: string, name: string): string | undefined {
  const match = tag.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`));
  return match ? decodeXml(match[1]) : undefined;
}

/** Texto de um elemento com trechos <t>, ignorando a leitura fonética (<rPh>). */
function textRuns(xml: string): string {
  return [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t(?:\s[^>]*)?\/>|<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
    .map(match => decodeXml(match[1] ?? '')).join('');
}

function read(files: Map<string, Buffer>, name: string): string | undefined {
  return files.get(name)?.toString('utf8');
}

function resolveTarget(target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const parts = ['xl'];
  for (const part of target.split('/')) {
    if (part === '..') parts.pop();
    else if (part !== '.') parts.push(part);
  }
  return parts.join('/');
}

// --- Estilos: quais células são datas ---

const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 22, 27, 28, 29, 30, 31, 34, 35, 36, 50, 51, 52, 53, 54, 57, 58]);

function dateStyleIndexes(stylesXml: string | undefined): Set<number> {
  const dates = new Set<number>();
  if (!stylesXml) return dates;
  const customDates = new Set<number>();
  for (const match of stylesXml.matchAll(/<numFmt\b[^>]*>/g)) {
    const id = Number(attribute(match[0], 'numFmtId'));
    const code = (attribute(match[0], 'formatCode') ?? '').replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '').replace(/\\./g, '');
    if (/[dy]/i.test(code)) customDates.add(id);
  }
  const cellXfs = stylesXml.match(/<cellXfs\b[\s\S]*?<\/cellXfs>/)?.[0] ?? '';
  [...cellXfs.matchAll(/<xf\b[^>]*>/g)].forEach((match, index) => {
    const id = Number(attribute(match[0], 'numFmtId') ?? 0);
    if (BUILTIN_DATE_FORMATS.has(id) || customDates.has(id)) dates.add(index);
  });
  return dates;
}

function serialToIsoDate(serial: number, date1904: boolean): string {
  const days = Math.floor(serial) + (date1904 ? 1462 : 0);
  const date = new Date(Date.UTC(1899, 11, 30) + days * 86400000);
  return date.toISOString().slice(0, 10);
}

function columnIndex(reference: string): number {
  let index = 0;
  for (const char of reference.replace(/\d+$/, '').toUpperCase()) index = index * 26 + (char.charCodeAt(0) - 64);
  return index - 1;
}

// --- Planilha ---

/** Lê a primeira aba visível de um arquivo .xlsx. */
export function readXlsx(buffer: Buffer): XlsxTable {
  const files = unzip(buffer);
  const workbook = read(files, 'xl/workbook.xml');
  if (!workbook) throw new SpreadsheetError('A planilha .xlsx não tem a pasta de trabalho (xl/workbook.xml).');
  const date1904 = /<workbookPr\b[^>]*date1904="(1|true)"/.test(workbook);
  const sheets = [...workbook.matchAll(/<sheet\b[^>]*>/g)].map(match => match[0]);
  const sheet = sheets.find(tag => !/state="(hidden|veryHidden)"/.test(tag)) ?? sheets[0];
  if (!sheet) throw new SpreadsheetError('A planilha não tem abas.');
  const relationId = attribute(sheet, 'r:id');
  const relations = read(files, 'xl/_rels/workbook.xml.rels') ?? '';
  const relation = [...relations.matchAll(/<Relationship\b[^>]*>/g)].map(match => match[0]).find(tag => attribute(tag, 'Id') === relationId);
  const sheetPath = relation ? resolveTarget(attribute(relation, 'Target') ?? '') : 'xl/worksheets/sheet1.xml';
  const sheetXml = read(files, sheetPath);
  if (!sheetXml) throw new SpreadsheetError(`A aba "${attribute(sheet, 'name')}" não foi encontrada no arquivo.`);

  const sharedStrings = [...(read(files, 'xl/sharedStrings.xml') ?? '').matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)].map(match => textRuns(match[1] ?? ''));
  const dateStyles = dateStyleIndexes(read(files, 'xl/styles.xml'));

  const rows: ReadCell[][] = [];
  let nextRow = 0;
  for (const rowMatch of sheetXml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const rowNumber = Number(attribute(rowMatch[1], 'r') ?? nextRow + 1);
    nextRow = rowNumber;
    const cells: ReadCell[] = [];
    let nextColumn = 0;
    for (const cellMatch of (rowMatch[2] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attributes = cellMatch[1];
      const body = cellMatch[2] ?? '';
      const reference = attribute(attributes, 'r');
      const column = reference ? columnIndex(reference) : nextColumn;
      nextColumn = column + 1;
      const type = attribute(attributes, 't') ?? 'n';
      const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let value: ReadCell = null;
      if (type === 'inlineStr') value = textRuns(body.match(/<is>([\s\S]*?)<\/is>/)?.[1] ?? '');
      else if (raw === undefined || raw === '') value = null; // fórmula sem valor calculado
      else if (type === 's') value = sharedStrings[Number(raw)] ?? '';
      else if (type === 'b') value = raw === '1';
      else if (type === 'str' || type === 'e' || type === 'd') value = decodeXml(raw);
      else {
        const number = Number(raw);
        const style = Number(attribute(attributes, 's') ?? 0);
        value = Number.isFinite(number) && dateStyles.has(style) ? serialToIsoDate(number, date1904) : number;
      }
      cells[column] = value;
    }
    for (let index = 0; index < cells.length; index++) if (cells[index] === undefined) cells[index] = null;
    rows[rowNumber - 1] = cells;
  }
  for (let index = 0; index < rows.length; index++) if (!rows[index]) rows[index] = [];
  return { sheetName: attribute(sheet, 'name') ?? 'Planilha', rows };
}
