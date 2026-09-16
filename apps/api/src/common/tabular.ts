import { inflateRawSync } from 'node:zlib';

export type TableValue = string | number | null | undefined;
export type TableRow = Record<string, TableValue>;

const XML_ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };

export function parseCsv(input: Buffer): string[][] {
  const text = input.toString('utf8').replace(/^\uFEFF/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = []; let field = ''; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) { row.push(field.trim()); field = ''; }
    else if (char === '\n') { row.push(field.replace(/\r$/, '').trim()); if (row.some(Boolean)) rows.push(row); row = []; field = ''; }
    else field += char;
  }
  row.push(field.replace(/\r$/, '').trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export function toCsv(headers: string[], rows: TableRow[]): Buffer {
  const escape = (value: TableValue) => {
    const text = value == null ? '' : String(value);
    return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return Buffer.from(`\uFEFF${[headers, ...rows.map((row) => headers.map((header) => row[header]))].map((row) => row.map(escape).join(';')).join('\r\n')}`, 'utf8');
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStore(files: Array<{ name: string; data: Buffer }>): Buffer {
  const localParts: Buffer[] = []; const centralParts: Buffer[] = []; let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name); const crc = crc32(file.data);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6); local.writeUInt32LE(crc, 14); local.writeUInt32LE(file.data.length, 18); local.writeUInt32LE(file.data.length, 22); local.writeUInt16LE(name.length, 26);
    localParts.push(local, name, file.data);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x800, 8); central.writeUInt32LE(crc, 16); central.writeUInt32LE(file.data.length, 20); central.writeUInt32LE(file.data.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
    centralParts.push(central, name); offset += local.length + name.length + file.data.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, ...centralParts, end]);
}

function unzipEntry(zip: Buffer, wanted: string): Buffer | undefined {
  const minimum = Math.max(0, zip.length - 65557); let eocd = -1;
  for (let index = zip.length - 22; index >= minimum; index -= 1) if (zip.readUInt32LE(index) === 0x06054b50) { eocd = index; break; }
  if (eocd < 0) throw new Error('El archivo Excel no es un ZIP válido.');
  const entries = zip.readUInt16LE(eocd + 10); let cursor = zip.readUInt32LE(eocd + 16);
  for (let entry = 0; entry < entries; entry += 1) {
    if (zip.readUInt32LE(cursor) !== 0x02014b50) throw new Error('El índice del archivo Excel está dañado.');
    const method = zip.readUInt16LE(cursor + 10); const size = zip.readUInt32LE(cursor + 20); const nameLength = zip.readUInt16LE(cursor + 28); const extraLength = zip.readUInt16LE(cursor + 30); const commentLength = zip.readUInt16LE(cursor + 32); const localOffset = zip.readUInt32LE(cursor + 42); const name = zip.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    if (name === wanted) {
      const localNameLength = zip.readUInt16LE(localOffset + 26); const localExtraLength = zip.readUInt16LE(localOffset + 28); const start = localOffset + 30 + localNameLength + localExtraLength; const compressed = zip.subarray(start, start + size);
      if (method === 0) return compressed; if (method === 8) return inflateRawSync(compressed); throw new Error('El Excel usa una compresión no compatible.');
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return undefined;
}

function xmlEscape(value: TableValue): string { return (value == null ? '' : String(value)).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!); }
function xmlDecode(value: string): string { return value.replace(/&(amp|lt|gt|quot|apos);/g, (match) => XML_ENTITIES[match] ?? match); }
function columnName(index: number): string { let result = ''; for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) result = String.fromCharCode(65 + ((n - 1) % 26)) + result; return result; }
function columnIndex(reference: string): number { let value = 0; for (const char of reference.replace(/\d/g, '')) value = value * 26 + char.charCodeAt(0) - 64; return value - 1; }

export function toXlsx(headers: string[], rows: TableRow[], sheetName = 'Reporte'): Buffer {
  const matrix = [headers, ...rows.map((row) => headers.map((header) => row[header]))];
  const sheetRows = matrix.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndexValue) => `<c r="${columnName(columnIndexValue)}${rowIndex + 1}" t="inlineStr"${rowIndex === 0 ? ' s="1"' : ''}><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`).join('')}</row>`).join('');
  const files = [
    { name: '[Content_Types].xml', data: Buffer.from('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>') },
    { name: '_rels/.rels', data: Buffer.from('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>') },
    { name: 'xl/workbook.xml', data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEscape(sheetName.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`) },
    { name: 'xl/_rels/workbook.xml.rels', data: Buffer.from('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>') },
    { name: 'xl/styles.xml', data: Buffer.from('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="0"/><fonts count="2"><font><sz val="10"/><name val="Arial"/><family val="2"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/><family val="2"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF17211C"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/></styleSheet>') },
    { name: 'xl/worksheets/sheet1.xml', data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>${sheetRows}</sheetData><autoFilter ref="A1:${columnName(headers.length - 1)}${matrix.length}"/></worksheet>`) },
  ];
  return zipStore(files);
}

export function parseXlsx(input: Buffer): string[][] {
  const sharedXml = unzipEntry(input, 'xl/sharedStrings.xml')?.toString('utf8');
  const shared = sharedXml ? [...sharedXml.matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g)].map((match) => xmlDecode([...match[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((part) => part[1]).join(''))) : [];
  const sheet = unzipEntry(input, 'xl/worksheets/sheet1.xml')?.toString('utf8');
  if (!sheet) throw new Error('El Excel no contiene una primera hoja válida.');
  return [...sheet.matchAll(/<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g)].map((rowMatch) => {
    const row: string[] = [];
    for (const cell of rowMatch[1].matchAll(/<c\s([^>]*)>([\s\S]*?)<\/c>/g)) {
      const reference = /\br="([A-Z]+\d+)"/.exec(cell[1])?.[1] ?? `${columnName(row.length)}1`; const type = /\bt="([^"]+)"/.exec(cell[1])?.[1]; const raw = type === 'inlineStr' ? /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/.exec(cell[2])?.[1] : /<v>([\s\S]*?)<\/v>/.exec(cell[2])?.[1]; const decoded = xmlDecode(raw ?? ''); row[columnIndex(reference)] = type === 's' ? (shared[Number(decoded)] ?? '') : decoded;
    }
    return Array.from({ length: row.length }, (_, index) => row[index] ?? '');
  }).filter((row) => row.some(Boolean));
}

function pdfEscape(value: string): string { return value.replace(/[^\x20-\xFF]/g, '?').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'); }

export function toPdf(title: string, headers: string[], rows: TableRow[]): Buffer {
  const lines: string[] = [];
  for (const [rowIndex,row] of rows.entries()) {
    const pairs=headers.map((header)=>`${header}: ${String(row[header]??'').replace(/\s+/g,' ')}`);let current='';
    for(const pair of pairs){if(current&&`${current} | ${pair}`.length>108){lines.push(current);current=pair;}else current=current?`${current} | ${pair}`:pair;}
    if(current)lines.push(current);lines.push(rowIndex===rows.length-1?'':'-'.repeat(108));
  }
  if(!rows.length)lines.push('No hay datos para el rango seleccionado.');
  const chunks: string[][] = []; for (let index = 0; index < lines.length; index += 46) chunks.push(lines.slice(index, index + 46)); if (!chunks.length) chunks.push([]);
  const objects: string[] = ['', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']; const pageIds: number[] = [];
  for (let pageIndex = 0; pageIndex < chunks.length; pageIndex += 1) {
    const pageId = objects.length + 1; const contentId = pageId + 1; pageIds.push(pageId);
    const contentLines = [`BT /F1 16 Tf 42 800 Td (${pdfEscape(title)}) Tj ET`, `BT /F1 8 Tf 42 783 Td (${pdfEscape(`Generado: ${new Date().toLocaleString('es-AR')} - Pagina ${pageIndex + 1}/${chunks.length}`)}) Tj ET`, ...chunks[pageIndex].map((line, index) => `BT /F1 7 Tf 42 ${760 - index * 15} Td (${pdfEscape(line)}) Tj ET`)];
    const stream = contentLines.join('\n'); objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`, `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
  }
  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>'; objects[1] = `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`;
  let output = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'; const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) { offsets[index + 1] = Buffer.byteLength(output, 'latin1'); output += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`; }
  const xref = Buffer.byteLength(output, 'latin1'); output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(output, 'latin1');
}
