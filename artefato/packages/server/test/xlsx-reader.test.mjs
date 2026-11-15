// Leitor de .xlsx: planilha real do openpyxl (ZIP comprimido, textos compartilhados, datas, aba oculta)
// e ida e volta com o gerador do próprio servidor.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import { patientImportTemplate, patientsFromTable } from '@routing/core';
import { readXlsx } from '../dist/import/xlsx-reader.js';
import { buildXlsx } from '../dist/export/xlsx.js';

test('planilha do openpyxl: primeira aba visível, linhas na numeração do Excel, datas e texto formatado', () => {
  const table = readXlsx(readFileSync(new URL('./fixtures/openpyxl.xlsx', import.meta.url)));
  assert.equal(table.sheetName, 'Pacientes');
  assert.deepEqual(table.rows[0].slice(0, 7), ['Código', 'Latitude', 'Longitude', 'Última visita', 'Prazo rígido', 'Categorias', 'Ausência motivo']);
  assert.deepEqual(table.rows[1].slice(0, 7), ['A1', -30.0012, -51.0034, '2026-09-20', '2026-10-10', 'tecnico_enfermagem:2; enfermagem', 'Férias & viagem <SP>']);
  assert.deepEqual(table.rows[2], []);
  assert.equal(table.rows[3][1], '-30,002');
  assert.equal(table.rows[3][6], 'Internação');
  assert.equal(table.rows[4][3], '2025-01-01');
  assert.equal(table.rows[0][7], null); // fórmula sem valor calculado

  const context = {
    healthCenter: { id: 'p', name: 'Posto', location: { lat: -30, lng: -51 } },
    polygons: [{ id: 'a', name: 'Área', vertices: [{ lat: -30.1, lng: -51.1 }, { lat: -30.1, lng: -50.9 }, { lat: -29.9, lng: -50.9 }, { lat: -29.9, lng: -51.1 }] }],
    teams: [], startDate: '2026-10-08'
  };
  const result = patientsFromTable(table.rows, context);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.patients.map(patient => patient.code), ['A1', 'A2', 'A3']);
  assert.equal(result.patients[0].hardDeadline, '2026-10-10');
  assert.equal(result.patients[1].conditions[0].lastVisitDate, '2026-09-15');
});

test('ida e volta com o gerador do servidor, inclusive comprimindo o ZIP', () => {
  const rows = patientImportTemplate({ lat: -30, lng: -51 }, '2026-10-08');
  const stored = buildXlsx([{ name: 'Pacientes', rows }]);
  // O gerador não grava células vazias; completa-se cada linha até a largura do cabeçalho.
  const read = readXlsx(stored).rows.map(row => rows[0].map((_, column) => row[column] ?? ''));
  assert.deepEqual(read, rows);
  // O mesmo conteúdo, agora com o ZIP comprimido como o Excel faz.
  assert.deepEqual(readXlsx(recompress(stored)).rows.map(row => rows[0].map((_, column) => row[column] ?? '')), rows);
});

/** Regrava um ZIP "stored" com compressão deflate (método 8). */
function recompress(zip) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  let pointer = zip.readUInt32LE(zip.length - 22 + 16);
  const count = zip.readUInt16LE(zip.length - 22 + 10);
  for (let index = 0; index < count; index++) {
    const nameLength = zip.readUInt16LE(pointer + 28);
    const size = zip.readUInt32LE(pointer + 24);
    const localOffset = zip.readUInt32LE(pointer + 42);
    const name = zip.subarray(pointer + 46, pointer + 46 + nameLength);
    const dataStart = localOffset + 30 + zip.readUInt16LE(localOffset + 26) + zip.readUInt16LE(localOffset + 28);
    const packed = deflateRawSync(zip.subarray(dataStart, dataStart + size));
    const local = Buffer.from(zip.subarray(localOffset, localOffset + 30));
    local.writeUInt16LE(8, 8); local.writeUInt32LE(packed.length, 18); local.writeUInt16LE(0, 28);
    const central = Buffer.from(zip.subarray(pointer, pointer + 46));
    central.writeUInt16LE(8, 10); central.writeUInt32LE(packed.length, 20); central.writeUInt32LE(offset, 42);
    central.writeUInt16LE(0, 30); central.writeUInt16LE(0, 32);
    locals.push(local, name, packed);
    centrals.push(central, name);
    offset += 30 + name.length + packed.length;
    pointer += 46 + nameLength + zip.readUInt16LE(pointer + 30) + zip.readUInt16LE(pointer + 32);
  }
  const centralBuffer = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054B50, 0); end.writeUInt16LE(count, 8); end.writeUInt16LE(count, 10);
  end.writeUInt32LE(centralBuffer.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuffer, end]);
}

test('arquivos que não são .xlsx recebem uma mensagem clara', () => {
  assert.throws(() => readXlsx(Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])), /formato antigo do Excel \(\.xls\)/);
  assert.throws(() => readXlsx(Buffer.from('codigo;latitude\nA;1\n')), /não é uma planilha \.xlsx/);
  const truncated = buildXlsx([{ name: 'x', rows: [['a']] }]).subarray(0, 200);
  assert.throws(() => readXlsx(truncated), /incompleta ou corrompida/);
});
