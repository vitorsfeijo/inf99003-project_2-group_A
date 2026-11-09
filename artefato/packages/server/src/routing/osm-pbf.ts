/**
 * Leitor mínimo de arquivos OSM PBF (https://wiki.openstreetmap.org/wiki/PBF_Format)
 * sem dependências externas: apenas `node:fs` e `node:zlib`.
 *
 * Suporta:
 * - enquadramento BlobHeader/Blob (tamanho big-endian de 4 bytes + mensagens);
 * - blobs `raw` e `zlib_data` (descompressão com `inflateSync`);
 * - PrimitiveBlock com tabela de strings, `granularity`, `lat_offset`, `lon_offset`;
 * - DenseNodes (ids, latitudes e longitudes com codificação delta) e Node simples;
 * - Ways (refs com codificação delta, keys/vals indexando a tabela de strings).
 *
 * Relações, metadados (`info`/`denseinfo`) e etiquetas de nós são ignorados.
 * O arquivo é lido blob a blob (leitura sequencial com `readSync`), de modo
 * que só um bloco descomprimido fica em memória por vez.
 */
import { closeSync, openSync, readSync, fstatSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

/** Recebe cada nó: identificador OSM e coordenadas em graus. */
export type OsmNodeHandler = (id: number, lat: number, lng: number) => void;

/** Recebe cada way: identificador OSM, referências de nós em ordem e etiquetas. */
export type OsmWayHandler = (id: number, refs: number[], tags: Record<string, string>) => void;

export interface OsmPbfHandlers {
  node?: OsmNodeHandler;
  way?: OsmWayHandler;
}

export interface OsmPbfStats {
  blobs: number;
  nodes: number;
  ways: number;
  /** Indica se os ids de nós chegaram em ordem estritamente crescente. */
  nodesSorted: boolean;
}

/** Recursos de cabeçalho que este leitor sabe interpretar. */
const SUPPORTED_REQUIRED_FEATURES = new Set(['OsmSchema-V0.6', 'DenseNodes']);

const TWO_POW_28 = 2 ** 28;
const TWO_POW_63 = 2 ** 63;
const TWO_POW_64 = 2 ** 64;

/**
 * Leitor de protobuf sobre um buffer. Os inteiros de 64 bits são devolvidos
 * como `number` (exatos até 2^53, suficiente para ids e coordenadas OSM).
 */
class ProtoReader {
  constructor(public buf: Uint8Array, public pos: number, public end: number) {}

  varint(): number {
    const buf = this.buf;
    let b = buf[this.pos++];
    let result = b & 0x7f;
    if (b < 0x80) return result;
    b = buf[this.pos++];
    result |= (b & 0x7f) << 7;
    if (b < 0x80) return result;
    b = buf[this.pos++];
    result |= (b & 0x7f) << 14;
    if (b < 0x80) return result;
    b = buf[this.pos++];
    result |= (b & 0x7f) << 21;
    if (b < 0x80) return result;
    // A partir de 28 bits usa aritmética de ponto flutuante para evitar estouro de 32 bits.
    let multiplier = TWO_POW_28;
    for (let shift = 28; shift < 70; shift += 7) {
      if (this.pos >= this.end) throw new Error('PBF corrompido: varint truncado.');
      b = buf[this.pos++];
      result += (b & 0x7f) * multiplier;
      if (b < 0x80) return result;
      multiplier *= 128;
    }
    throw new Error('PBF corrompido: varint com mais de 10 bytes.');
  }

  /** int64 com sinal em complemento de dois (campos `int64`). */
  int64(): number {
    const value = this.varint();
    return value >= TWO_POW_63 ? value - TWO_POW_64 : value;
  }

  /** sint64 com codificação zigzag. */
  sint64(): number {
    const value = this.varint();
    if (value < 0x80000000) return (value >>> 1) ^ -(value & 1);
    return value % 2 === 0 ? value / 2 : -(value + 1) / 2;
  }

  /** Lê o comprimento de um campo length-delimited e devolve [início, fim). */
  bytes(): [number, number] {
    const length = this.varint();
    const start = this.pos;
    const end = start + length;
    if (end > this.end) throw new Error('PBF corrompido: campo length-delimited excede a mensagem.');
    this.pos = end;
    return [start, end];
  }

  skip(wireType: number): void {
    switch (wireType) {
      case 0: this.varint(); break;
      case 1: this.pos += 8; break;
      case 2: this.bytes(); break;
      case 5: this.pos += 4; break;
      default: throw new Error(`PBF corrompido: tipo de fio protobuf não suportado (${wireType}).`);
    }
    if (this.pos > this.end) throw new Error('PBF corrompido: campo excede a mensagem.');
  }
}

/** Decodificador UTF-8 compartilhado para a tabela de strings. */
const utf8 = new TextDecoder('utf-8');

/** Lê exatamente `length` bytes na posição `position` do descritor. */
function readExactly(fd: number, length: number, position: number, fileSize: number): Uint8Array {
  if (position + length > fileSize) {
    throw new Error(`PBF truncado: esperados ${length} bytes na posição ${position}, arquivo tem ${fileSize}.`);
  }
  const out = new Uint8Array(length);
  let done = 0;
  while (done < length) {
    const read = readSync(fd, out, done, length - done, position + done);
    if (read <= 0) throw new Error(`PBF truncado: leitura interrompida na posição ${position + done}.`);
    done += read;
  }
  return out;
}

/** Decodifica um Blob e devolve o conteúdo descomprimido. */
function decodeBlob(blob: Uint8Array): Uint8Array {
  const reader = new ProtoReader(blob, 0, blob.length);
  let raw: [number, number] | null = null;
  let zlib: [number, number] | null = null;
  let rawSize = -1;
  let unsupported = '';
  while (reader.pos < reader.end) {
    const key = reader.varint();
    const field = key >>> 3;
    const wire = key & 7;
    if (field === 1 && wire === 2) raw = reader.bytes();
    else if (field === 2 && wire === 0) rawSize = reader.varint();
    else if (field === 3 && wire === 2) zlib = reader.bytes();
    else if (field === 4 && wire === 2) { reader.bytes(); unsupported = 'lzma'; }
    else if (field === 5 && wire === 2) { reader.bytes(); unsupported = 'bzip2'; }
    else if (field === 6 && wire === 2) { reader.bytes(); unsupported = 'lz4'; }
    else if (field === 7 && wire === 2) { reader.bytes(); unsupported = 'zstd'; }
    else reader.skip(wire);
  }
  if (raw) return blob.subarray(raw[0], raw[1]);
  if (zlib) {
    const inflated = inflateSync(blob.subarray(zlib[0], zlib[1]));
    if (rawSize >= 0 && inflated.length !== rawSize) {
      throw new Error(`PBF corrompido: bloco descomprimido com ${inflated.length} bytes, esperado ${rawSize}.`);
    }
    return inflated;
  }
  if (unsupported) throw new Error(`PBF usa compressão ${unsupported}, não suportada (apenas raw e zlib).`);
  throw new Error('PBF corrompido: Blob sem dados.');
}

/** Valida o OSMHeader: recusa recursos obrigatórios que o leitor não entende. */
function checkHeaderBlock(data: Uint8Array): void {
  const reader = new ProtoReader(data, 0, data.length);
  while (reader.pos < reader.end) {
    const key = reader.varint();
    const field = key >>> 3;
    const wire = key & 7;
    if (field === 4 && wire === 2) {
      const [start, end] = reader.bytes();
      const feature = utf8.decode(data.subarray(start, end));
      if (!SUPPORTED_REQUIRED_FEATURES.has(feature)) {
        throw new Error(`PBF exige o recurso "${feature}", não suportado por este leitor.`);
      }
    } else {
      reader.skip(wire);
    }
  }
}

/** Estado de decodificação de um PrimitiveBlock. */
interface BlockContext {
  data: Uint8Array;
  stringRanges: number[]; // pares [início, fim) na tabela de strings
  strings: (string | undefined)[];
  granularity: number;
  latOffset: number;
  lonOffset: number;
}

function blockString(ctx: BlockContext, index: number): string {
  let value = ctx.strings[index];
  if (value === undefined) {
    const start = ctx.stringRanges[index * 2];
    const end = ctx.stringRanges[index * 2 + 1];
    if (start === undefined || end === undefined) {
      throw new Error(`PBF corrompido: índice ${index} fora da tabela de strings.`);
    }
    value = utf8.decode(ctx.data.subarray(start, end));
    ctx.strings[index] = value;
  }
  return value;
}

/** Lê um campo inteiro repetido, compactado (wire 2) ou não (wire 0), acrescentando em `out`. */
function readRepeatedUint(reader: ProtoReader, wire: number, out: number[]): void {
  if (wire === 2) {
    const [start, end] = reader.bytes();
    const inner = new ProtoReader(reader.buf, start, end);
    while (inner.pos < end) out.push(inner.varint());
  } else if (wire === 0) {
    out.push(reader.varint());
  } else {
    reader.skip(wire);
  }
}

function decodeDenseNodes(ctx: BlockContext, start: number, end: number, onNode: OsmNodeHandler, stats: OsmPbfStats, last: { id: number }): void {
  const data = ctx.data;
  const reader = new ProtoReader(data, start, end);
  let ids: [number, number] | null = null;
  let lats: [number, number] | null = null;
  let lons: [number, number] | null = null;
  while (reader.pos < reader.end) {
    const key = reader.varint();
    const field = key >>> 3;
    const wire = key & 7;
    if (field === 1 && wire === 2) ids = reader.bytes();
    else if (field === 8 && wire === 2) lats = reader.bytes();
    else if (field === 9 && wire === 2) lons = reader.bytes();
    else reader.skip(wire);
  }
  if (!ids) return;
  if (!lats || !lons) throw new Error('PBF corrompido: DenseNodes sem latitudes/longitudes.');
  const idReader = new ProtoReader(data, ids[0], ids[1]);
  const latReader = new ProtoReader(data, lats[0], lats[1]);
  const lonReader = new ProtoReader(data, lons[0], lons[1]);
  const scale = 1e-9 * ctx.granularity;
  const latBase = 1e-9 * ctx.latOffset;
  const lonBase = 1e-9 * ctx.lonOffset;
  let id = 0;
  let rawLat = 0;
  let rawLon = 0;
  while (idReader.pos < idReader.end) {
    if (latReader.pos >= latReader.end || lonReader.pos >= lonReader.end) {
      throw new Error('PBF corrompido: DenseNodes com listas de tamanhos diferentes.');
    }
    id += idReader.sint64();
    rawLat += latReader.sint64();
    rawLon += lonReader.sint64();
    if (id <= last.id) stats.nodesSorted = false;
    last.id = id;
    stats.nodes++;
    onNode(id, latBase + scale * rawLat, lonBase + scale * rawLon);
  }
}

function decodeNode(ctx: BlockContext, start: number, end: number, onNode: OsmNodeHandler, stats: OsmPbfStats, last: { id: number }): void {
  const reader = new ProtoReader(ctx.data, start, end);
  let id = 0;
  let rawLat = 0;
  let rawLon = 0;
  while (reader.pos < reader.end) {
    const key = reader.varint();
    const field = key >>> 3;
    const wire = key & 7;
    if (field === 1 && wire === 0) id = reader.sint64();
    else if (field === 8 && wire === 0) rawLat = reader.sint64();
    else if (field === 9 && wire === 0) rawLon = reader.sint64();
    else reader.skip(wire);
  }
  if (id <= last.id) stats.nodesSorted = false;
  last.id = id;
  stats.nodes++;
  onNode(id, 1e-9 * (ctx.latOffset + ctx.granularity * rawLat), 1e-9 * (ctx.lonOffset + ctx.granularity * rawLon));
}

function decodeWay(ctx: BlockContext, start: number, end: number, onWay: OsmWayHandler, stats: OsmPbfStats): void {
  const reader = new ProtoReader(ctx.data, start, end);
  let id = 0;
  const keys: number[] = [];
  const vals: number[] = [];
  const refs: number[] = [];
  while (reader.pos < reader.end) {
    const key = reader.varint();
    const field = key >>> 3;
    const wire = key & 7;
    if (field === 1 && wire === 0) id = reader.int64();
    else if (field === 2) readRepeatedUint(reader, wire, keys);
    else if (field === 3) readRepeatedUint(reader, wire, vals);
    else if (field === 8 && wire === 2) {
      const [refStart, refEnd] = reader.bytes();
      const inner = new ProtoReader(ctx.data, refStart, refEnd);
      let ref = refs.length > 0 ? refs[refs.length - 1] : 0;
      while (inner.pos < refEnd) {
        ref += inner.sint64();
        refs.push(ref);
      }
    } else if (field === 8 && wire === 0) {
      const previous = refs.length > 0 ? refs[refs.length - 1] : 0;
      refs.push(previous + reader.sint64());
    } else reader.skip(wire);
  }
  if (keys.length !== vals.length) throw new Error(`PBF corrompido: way ${id} com keys/vals de tamanhos diferentes.`);
  const tags: Record<string, string> = {};
  for (let i = 0; i < keys.length; i++) tags[blockString(ctx, keys[i])] = blockString(ctx, vals[i]);
  stats.ways++;
  onWay(id, refs, tags);
}

function decodePrimitiveBlock(data: Uint8Array, handlers: OsmPbfHandlers, stats: OsmPbfStats, last: { id: number }): void {
  const reader = new ProtoReader(data, 0, data.length);
  const groups: [number, number][] = [];
  const ctx: BlockContext = { data, stringRanges: [], strings: [], granularity: 100, latOffset: 0, lonOffset: 0 };
  while (reader.pos < reader.end) {
    const key = reader.varint();
    const field = key >>> 3;
    const wire = key & 7;
    if (field === 1 && wire === 2) {
      const [start, end] = reader.bytes();
      const table = new ProtoReader(data, start, end);
      while (table.pos < end) {
        const tableKey = table.varint();
        if (tableKey >>> 3 === 1 && (tableKey & 7) === 2) {
          const [sStart, sEnd] = table.bytes();
          ctx.stringRanges.push(sStart, sEnd);
        } else {
          table.skip(tableKey & 7);
        }
      }
    } else if (field === 2 && wire === 2) groups.push(reader.bytes());
    else if (field === 17 && wire === 0) ctx.granularity = reader.int64();
    else if (field === 19 && wire === 0) ctx.latOffset = reader.int64();
    else if (field === 20 && wire === 0) ctx.lonOffset = reader.int64();
    else reader.skip(wire);
  }
  for (const [groupStart, groupEnd] of groups) {
    const group = new ProtoReader(data, groupStart, groupEnd);
    while (group.pos < group.end) {
      const key = group.varint();
      const field = key >>> 3;
      const wire = key & 7;
      if (wire !== 2) { group.skip(wire); continue; }
      const [start, end] = group.bytes();
      if (field === 1 && handlers.node) decodeNode(ctx, start, end, handlers.node, stats, last);
      else if (field === 2 && handlers.node) decodeDenseNodes(ctx, start, end, handlers.node, stats, last);
      else if (field === 3 && handlers.way) decodeWay(ctx, start, end, handlers.way, stats);
      // Relações (4) e changesets (5) são ignorados.
    }
  }
}

/**
 * Percorre o arquivo PBF chamando os callbacks para cada nó e way.
 * Lança `Error` se o arquivo estiver corrompido ou usar recursos não suportados.
 */
export function readOsmPbf(filePath: string, handlers: OsmPbfHandlers): OsmPbfStats {
  const stats: OsmPbfStats = { blobs: 0, nodes: 0, ways: 0, nodesSorted: true };
  const last = { id: -Infinity };
  const fd = openSync(filePath, 'r');
  try {
    const fileSize = fstatSync(fd).size;
    let position = 0;
    while (position < fileSize) {
      const lengthBytes = readExactly(fd, 4, position, fileSize);
      const headerLength = ((lengthBytes[0] << 24) >>> 0) + (lengthBytes[1] << 16) + (lengthBytes[2] << 8) + lengthBytes[3];
      if (headerLength > 64 * 1024) throw new Error(`PBF corrompido: BlobHeader com ${headerLength} bytes na posição ${position}.`);
      position += 4;
      const header = readExactly(fd, headerLength, position, fileSize);
      position += headerLength;
      const headerReader = new ProtoReader(header, 0, header.length);
      let type = '';
      let dataSize = -1;
      while (headerReader.pos < headerReader.end) {
        const key = headerReader.varint();
        const field = key >>> 3;
        const wire = key & 7;
        if (field === 1 && wire === 2) {
          const [start, end] = headerReader.bytes();
          type = utf8.decode(header.subarray(start, end));
        } else if (field === 3 && wire === 0) dataSize = headerReader.varint();
        else headerReader.skip(wire);
      }
      if (dataSize < 0 || dataSize > 64 * 1024 * 1024) {
        throw new Error(`PBF corrompido: Blob com tamanho inválido (${dataSize}) na posição ${position}.`);
      }
      const blob = readExactly(fd, dataSize, position, fileSize);
      position += dataSize;
      stats.blobs++;
      if (type === 'OSMHeader') checkHeaderBlock(decodeBlob(blob));
      else if (type === 'OSMData') decodePrimitiveBlock(decodeBlob(blob), handlers, stats, last);
      // Outros tipos de blob são ignorados, conforme a especificação.
    }
  } finally {
    closeSync(fd);
  }
  return stats;
}
