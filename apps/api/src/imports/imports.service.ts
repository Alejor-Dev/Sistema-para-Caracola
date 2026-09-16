import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ActionContext } from '../iam/users.service';
import { money } from '../common/money';
import { parseCsv, parseXlsx, toCsv } from '../common/tabular';
import { PrismaService } from '../prisma/prisma.service';

export interface ImportRow { rowNumber: number; name: string; sku: string; barcode?: string; category?: string; brand?: string; gender?: string; color?: string; size?: string; material?: string; stock: number; minStock: number; cost: string; price: string; }
export interface ImportError { rowNumber: number; field: string; message: string; }

const headerAliases: Record<string, keyof Omit<ImportRow,'rowNumber'>> = {
  nombre:'name', producto:'name', sku:'sku', codigo:'barcode', codigo_de_barras:'barcode', codigobarras:'barcode', barcode:'barcode', categoria:'category', marca:'brand', genero:'gender', color:'color', talle:'size', talla:'size', material:'material', stock:'stock', cantidad:'stock', stock_minimo:'minStock', minimo:'minStock', costo:'cost', precio:'price', precio_venta:'price',
};
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
const code = (value: string) => normalize(value).replace(/_/g,'-').slice(0,80) || 'sin-nombre';

@Injectable()
export class ImportsService {
  constructor(private readonly prisma: PrismaService) {}

  template() { return toCsv(['nombre','sku','codigo_barras','categoria','marca','genero','color','talle','material','stock','stock_minimo','costo','precio'], [{ nombre:'Remera básica',sku:'REM-NEG-M',codigo_barras:'779000000001',categoria:'Indumentaria',marca:'Marca propia',genero:'Unisex',color:'Negro',talle:'M',material:'Algodón',stock:10,stock_minimo:3,costo:'10000.00',precio:'15000.00' }]); }

  async preview(file: Express.Multer.File | undefined, context: ActionContext) {
    if (!file) throw new BadRequestException('Debe seleccionar un archivo CSV o XLSX.');
    if (file.size > 5*1024*1024) throw new BadRequestException('El archivo supera el máximo de 5 MB.');
    const extension = file.originalname.split('.').pop()?.toLowerCase(); if (!['csv','xlsx'].includes(extension ?? '')) throw new BadRequestException('Solo se admiten archivos CSV o XLSX.');
    let matrix: string[][]; try { matrix = extension === 'csv' ? parseCsv(file.buffer) : parseXlsx(file.buffer); } catch (error) { throw new BadRequestException(error instanceof Error ? error.message : 'No se pudo leer el archivo.'); }
    if (matrix.length < 2) throw new BadRequestException('El archivo no contiene filas para importar.');
    if (matrix.length-1 > 5000) throw new BadRequestException('El máximo por importación es de 5.000 filas.');
    const mappedHeaders = matrix[0].map((header) => headerAliases[normalize(header)]); const required = ['name','sku','cost','price'];
    const missing = required.filter((field) => !mappedHeaders.includes(field as keyof Omit<ImportRow,'rowNumber'>)); if (missing.length) throw new BadRequestException(`Faltan columnas obligatorias: ${missing.join(', ')}.`);
    const rows: ImportRow[] = []; const errors: ImportError[] = []; const skus = new Map<string,number>(); const barcodes = new Map<string,number>();
    for (let index=1; index<matrix.length; index+=1) {
      const raw: Record<string,string> = {}; mappedHeaders.forEach((header,column) => { if (header) raw[header]=matrix[index][column]?.trim() ?? ''; }); const rowNumber=index+1;
      const stock=this.integer(raw.stock,rowNumber,'stock',errors); const minStock=this.integer(raw.minStock,rowNumber,'stock_minimo',errors); const sku=(raw.sku??'').toUpperCase(); const barcode=raw.barcode||undefined;
      if (!(raw.name??'').trim()) errors.push({rowNumber,field:'nombre',message:'El nombre es obligatorio.'}); if (!sku) errors.push({rowNumber,field:'sku',message:'El SKU es obligatorio.'});
      for (const field of ['cost','price'] as const) { if (!/^\d{1,15}([.,]\d{1,4})?$/.test(raw[field]??'')) errors.push({rowNumber,field:field==='cost'?'costo':'precio',message:'Debe ser un importe positivo con hasta 4 decimales.'}); }
      if (sku) { if (skus.has(sku)) errors.push({rowNumber,field:'sku',message:`SKU repetido también en la fila ${skus.get(sku)}.`}); else skus.set(sku,rowNumber); }
      if (barcode) { if (barcodes.has(barcode)) errors.push({rowNumber,field:'codigo_barras',message:`Código repetido también en la fila ${barcodes.get(barcode)}.`}); else barcodes.set(barcode,rowNumber); }
      rows.push({rowNumber,name:(raw.name??'').trim(),sku,barcode,category:raw.category||undefined,brand:raw.brand||undefined,gender:raw.gender||undefined,color:raw.color||undefined,size:raw.size||undefined,material:raw.material||undefined,stock,minStock,cost:(raw.cost??'').replace(',','.'),price:(raw.price??'').replace(',','.')});
    }
    const [existingSkus,existingBarcodes]=await Promise.all([this.prisma.productVariant.findMany({where:{sku:{in:[...skus.keys()]}},select:{sku:true}}),this.prisma.productVariant.findMany({where:{barcode:{in:[...barcodes.keys()]}},select:{barcode:true}})]);
    for(const item of existingSkus) errors.push({rowNumber:skus.get(item.sku)!,field:'sku',message:'El SKU ya existe en el sistema.'}); for(const item of existingBarcodes) if(item.barcode) errors.push({rowNumber:barcodes.get(item.barcode)!,field:'codigo_barras',message:'El código de barras ya existe en el sistema.'});
    const invalidRows=new Set(errors.map((error)=>error.rowNumber)); const batch=await this.prisma.productImport.create({data:{originalFilename:file.originalname.slice(0,255),format:extension!,totalRows:rows.length,validRows:rows.length-invalidRows.size,errorRows:invalidRows.size,rowsData:rows as unknown as Prisma.InputJsonValue,errorsData:errors as unknown as Prisma.InputJsonValue,createdBy:context.actor.id,expiresAt:new Date(Date.now()+24*60*60*1000)}});
    await this.prisma.auditLog.create({data:{actorUserId:context.actor.id,action:'import.products.previewed',entityType:'product_import',entityId:batch.id,afterData:{filename:batch.originalFilename,totalRows:rows.length,errorRows:invalidRows.size},ip:context.ip,userAgent:context.userAgent?.slice(0,512),requestId:context.requestId}});
    return {id:batch.id,filename:batch.originalFilename,totalRows:rows.length,validRows:batch.validRows,errorRows:batch.errorRows,canConfirm:batch.errorRows===0,rows:rows.slice(0,50),errors:errors.slice(0,200),expiresAt:batch.expiresAt};
  }

  async confirm(importId:string, context:ActionContext) {
    const batch=await this.prisma.productImport.findFirst({where:{id:importId,createdBy:context.actor.id}}); if(!batch) throw new NotFoundException('La importación no existe.'); if(batch.status==='CONFIRMED') return {id:batch.id,status:batch.status,createdProducts:batch.validRows,createdVariants:batch.validRows}; if(batch.status!=='PENDING') throw new BadRequestException('La importación ya no está disponible.'); if(batch.expiresAt<new Date()) { await this.prisma.productImport.update({where:{id:batch.id},data:{status:'REJECTED'}}); throw new BadRequestException('La previsualización venció; vuelva a cargar el archivo.'); } if(batch.errorRows>0) throw new BadRequestException('Corrija todas las filas con errores antes de confirmar.');
    const rows=batch.rowsData as unknown as ImportRow[];
    const result=await this.prisma.$transaction(async(tx)=>{
      const skuCount=await tx.productVariant.count({where:{sku:{in:rows.map((row)=>row.sku)}}}); if(skuCount) throw new BadRequestException('Uno de los SKU fue creado después de la previsualización. Vuelva a validar el archivo.');
      const categoryIds=new Map<string,string>(); const brandIds=new Map<string,string>(); const genderIds=new Map<string,string>(); const colorIds=new Map<string,string>(); const sizeIds=new Map<string,string>(); const materialIds=new Map<string,string>();
      for(const row of rows) {
        if(row.category&&!categoryIds.has(row.category)){const item=await tx.category.upsert({where:{code:code(row.category)},update:{name:row.category,isActive:true},create:{code:code(row.category),name:row.category}});categoryIds.set(row.category,item.id);}
        if(row.brand&&!brandIds.has(row.brand)){const item=await tx.brand.upsert({where:{code:code(row.brand)},update:{name:row.brand,isActive:true},create:{code:code(row.brand),name:row.brand}});brandIds.set(row.brand,item.id);}
        if(row.gender&&!genderIds.has(row.gender)){const item=await tx.gender.upsert({where:{code:code(row.gender)},update:{name:row.gender,isActive:true},create:{code:code(row.gender),name:row.gender}});genderIds.set(row.gender,item.id);}
        if(row.color&&!colorIds.has(row.color)){const item=await tx.color.upsert({where:{code:code(row.color)},update:{name:row.color,isActive:true},create:{code:code(row.color),name:row.color}});colorIds.set(row.color,item.id);}
        if(row.size&&!sizeIds.has(row.size)){const item=await tx.size.upsert({where:{code:code(row.size)},update:{name:row.size,isActive:true},create:{code:code(row.size),name:row.size}});sizeIds.set(row.size,item.id);}
        if(row.material&&!materialIds.has(row.material)){const item=await tx.material.upsert({where:{code:code(row.material)},update:{name:row.material,isActive:true},create:{code:code(row.material),name:row.material}});materialIds.set(row.material,item.id);}
      }
      const groups=new Map<string,ImportRow[]>(); for(const row of rows){const key=[normalize(row.name),normalize(row.category??''),normalize(row.brand??''),normalize(row.gender??'')].join('|');groups.set(key,[...(groups.get(key)??[]),row]);}
      let products=0; for(const group of groups.values()) { const first=group[0]; const product=await tx.product.create({data:{name:first.name,slug:await this.uniqueSlug(tx,first.name),categoryId:first.category?categoryIds.get(first.category):undefined,brandId:first.brand?brandIds.get(first.brand):undefined,genderId:first.gender?genderIds.get(first.gender):undefined,minStock:first.minStock,materials:first.material?{create:[{materialId:materialIds.get(first.material)!}]}:undefined}}); products+=1;
        for(const row of group){const variant=await tx.productVariant.create({data:{productId:product.id,sku:row.sku,barcode:row.barcode||null,colorId:row.color?colorIds.get(row.color):undefined,sizeId:row.size?sizeIds.get(row.size):undefined,costAmount:money(row.cost,'costo'),salePriceAmount:money(row.price,'precio')}});await tx.inventoryBalance.create({data:{variantId:variant.id,quantity:row.stock}});await tx.priceHistory.createMany({data:[{variantId:variant.id,priceType:'COST',oldAmount:0,newAmount:row.cost,changedBy:context.actor.id,reason:'Importación inicial'},{variantId:variant.id,priceType:'SALE',oldAmount:0,newAmount:row.price,changedBy:context.actor.id,reason:'Importación inicial'}]});if(row.stock>0)await tx.inventoryMovement.create({data:{variantId:variant.id,type:'INITIAL',quantityDelta:row.stock,quantityBefore:0,quantityAfter:row.stock,reasonCode:'product_import',referenceType:'product_import',referenceId:batch.id,userId:context.actor.id}});}
      }
      await tx.productImport.update({where:{id:batch.id},data:{status:'CONFIRMED',confirmedAt:new Date()}});await tx.auditLog.create({data:{actorUserId:context.actor.id,action:'import.products.confirmed',entityType:'product_import',entityId:batch.id,afterData:{products,variants:rows.length,filename:batch.originalFilename},ip:context.ip,userAgent:context.userAgent?.slice(0,512),requestId:context.requestId}});return {products,variants:rows.length};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,maxWait:10000,timeout:60000});
    return {id:batch.id,status:'CONFIRMED',createdProducts:result.products,createdVariants:result.variants};
  }

  private integer(value:string|undefined,rowNumber:number,field:string,errors:ImportError[]){if(value==null||value==='')return 0;if(!/^\d+$/.test(value)){errors.push({rowNumber,field,message:'Debe ser un número entero igual o mayor a cero.'});return 0;}const parsed=Number(value);if(!Number.isSafeInteger(parsed)||parsed>1000000){errors.push({rowNumber,field,message:'El valor está fuera del rango permitido.'});return 0;}return parsed;}
  private async uniqueSlug(tx:Prisma.TransactionClient,name:string){const base=code(name).slice(0,170)||'producto';let slug=base;for(let suffix=2;await tx.product.findUnique({where:{slug},select:{id:true}});suffix+=1)slug=`${base}-${suffix}`;return slug;}
}
