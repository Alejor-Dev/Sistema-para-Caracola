import { describe,expect,it } from 'vitest';
import { parseCsv,parseXlsx,toCsv,toPdf,toXlsx } from './tabular';

describe('tabular exports',()=>{
  it('round-trips CSV with Argentine delimiter and quoted values',()=>{const headers=['Nombre','SKU','Precio'];const csv=toCsv(headers,[{Nombre:'Remera, clásica',SKU:'REM-1',Precio:'15000.00'}]);expect(parseCsv(csv)).toEqual([headers,['Remera, clásica','REM-1','15000.00']]);});
  it('creates a valid XLSX package that the importer can read',()=>{const headers=['nombre','sku','costo','precio'];const xlsx=toXlsx(headers,[{nombre:'Buzo algodón',sku:'BUZ-M',costo:'10000.00',precio:'18000.00'}]);expect(xlsx.readUInt32LE(0)).toBe(0x04034b50);expect(parseXlsx(xlsx)).toEqual([headers,['Buzo algodón','BUZ-M','10000.00','18000.00']]);});
  it('creates a complete multipage PDF',()=>{const rows=Array.from({length:80},(_,index)=>({Producto:`Producto ${index+1}`,SKU:`SKU-${index+1}`,Stock:index}));const pdf=toPdf('Stock completo',['Producto','SKU','Stock'],rows);expect(pdf.subarray(0,8).toString()).toBe('%PDF-1.4');expect(Number(/\/Count (\d+)/.exec(pdf.toString('latin1'))?.[1])).toBeGreaterThan(1);expect(pdf.toString('latin1')).toContain('%%EOF');});
});
