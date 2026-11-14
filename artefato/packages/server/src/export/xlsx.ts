/**
 * Gerador mínimo de planilhas Excel (.xlsx, Office Open XML) sem dependências externas.
 * Uma pasta de trabalho é um ZIP com alguns arquivos XML; usamos ZIP sem compressão
 * ("stored"), que o Excel, o LibreOffice e o Google Planilhas abrem normalmente.
 */

export type CellValue = string | number | boolean | null | undefined;

export interface Sheet {
  name: string;                 // Até 31 caracteres, sem : \ / ? * [ ]
  rows: CellValue[][];          // A primeira linha é o cabeçalho (em negrito)
  columnWidths?: number[];      // Largura em caracteres
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Buffer): number {
  let crc = 0xFFFFFFFF;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/** ZIP "stored" (sem compressão) com os arquivos na ordem dada. */
function zip(files: { name: string; content: string }[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8');
    const data = Buffer.from(file.content, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);          // versão necessária
    local.writeUInt16LE(0x0800, 6);      // nomes em UTF-8
    local.writeUInt16LE(0, 8);           // sem compressão
    local.writeUInt16LE(0, 10);          // hora
    local.writeUInt16LE(0x21, 12);       // data (1980-01-01)
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + data.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, ...centralParts, end]);
}

function escapeXml(text: string): string {
  // Remove caracteres de controle que o XML não aceita.
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function columnName(index: number): string {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

function cellXml(value: CellValue, ref: string, header: boolean): string {
  const style = header ? ' s="1"' : '';
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"${style}><v>${value}</v></c>`;
  if (typeof value === 'boolean') return `<c r="${ref}" t="b"${style}><v>${value ? 1 : 0}</v></c>`;
  return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${escapeXml(String(value))}</t></is></c>`;
}

function sheetXml(sheet: Sheet): string {
  const widths = sheet.columnWidths ?? (sheet.rows[0] ?? []).map((_, column) =>
    Math.min(60, Math.max(8, ...sheet.rows.map(row => String(row[column] ?? '').length + 2))));
  const cols = widths.length ? `<cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('')}</cols>` : '';
  const rows = sheet.rows.map((row, rowIndex) =>
    `<row r="${rowIndex + 1}">${row.map((value, column) => cellXml(value, `${columnName(column)}${rowIndex + 1}`, rowIndex === 0)).join('')}</row>`).join('');
  const freeze = sheet.rows.length > 1
    ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${freeze}${cols}<sheetData>${rows}</sheetData></worksheet>`;
}

function safeSheetName(name: string, used: Set<string>): string {
  let base = name.replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'Planilha';
  let candidate = base;
  for (let n = 2; used.has(candidate.toLowerCase()); n++) candidate = `${base.slice(0, 28)} ${n}`;
  used.add(candidate.toLowerCase());
  return candidate;
}

/** Monta a pasta de trabalho .xlsx com uma planilha por item. */
export function buildXlsx(sheets: Sheet[]): Buffer {
  if (!sheets.length) throw new Error('A planilha precisa de ao menos uma aba.');
  const used = new Set<string>();
  const names = sheets.map(sheet => safeSheetName(sheet.name, used));
  const files = [
    { name: '[Content_Types].xml', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>` },
    { name: '_rels/.rels', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'xl/workbook.xml', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((name, index) => `<sheet name="${escapeXml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: 'xl/styles.xml', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>` },
    ...sheets.map((sheet, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, content: sheetXml(sheet) }))
  ];
  return zip(files);
}

export const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
