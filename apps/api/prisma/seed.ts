import { PrismaClient } from '@prisma/client';
import { PERMISSION_CATALOG } from '../src/setup/permissions.catalog';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  for (const [code, module, description] of PERMISSION_CATALOG) {
    await prisma.permission.upsert({ where: { code }, update: { module, description }, create: { code, module, description } });
  }

  const administrator = await prisma.role.findUnique({ where: { code: 'administrator' } });
  if (administrator) {
    const permissions = await prisma.permission.findMany({ select: { id: true } });
    for (const permission of permissions) await prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId: administrator.id, permissionId: permission.id } }, update: {}, create: { roleId: administrator.id, permissionId: permission.id } });
  }

  const paymentMethods = [['cash', 'Efectivo'], ['transfer', 'Transferencia'], ['mercado-pago', 'Mercado Pago'], ['debit', 'Débito'], ['credit', 'Crédito'], ['other', 'Otro']] as const;
  for (const [sortOrder, [code, name]] of paymentMethods.entries()) await prisma.paymentMethod.upsert({ where: { code }, update: { name, sortOrder }, create: { code, name, sortOrder } });

  const simpleCatalogs = {
    category: [['indumentaria', 'Indumentaria'], ['calzado', 'Calzado'], ['accesorios', 'Accesorios']],
    gender: [['mujer', 'Mujer'], ['hombre', 'Hombre'], ['unisex', 'Unisex'], ['nino', 'Niño'], ['nina', 'Niña'], ['bebe', 'Bebé'], ['otro', 'Otro']],
    garmentType: [['remera', 'Remera'], ['camisa', 'Camisa'], ['pantalon', 'Pantalón'], ['jean', 'Jean'], ['short', 'Short'], ['buzo', 'Buzo'], ['campera', 'Campera'], ['vestido', 'Vestido'], ['pollera', 'Pollera'], ['conjunto', 'Conjunto'], ['calzado', 'Calzado'], ['ropa-interior', 'Ropa interior'], ['accesorio', 'Accesorio'], ['otro', 'Otro']],
    material: [['algodon', 'Algodón'], ['poliester', 'Poliéster'], ['jean', 'Jean'], ['lino', 'Lino'], ['lana', 'Lana'], ['lycra', 'Lycra'], ['cuero', 'Cuero'], ['sintetico', 'Sintético'], ['mezcla', 'Mezcla'], ['otro', 'Otro']],
    color: [['negro', 'Negro'], ['blanco', 'Blanco'], ['azul', 'Azul'], ['rojo', 'Rojo'], ['verde', 'Verde'], ['gris', 'Gris'], ['beige', 'Beige'], ['marron', 'Marrón'], ['rosa', 'Rosa'], ['multicolor', 'Multicolor']],
    size: [['xs', 'XS'], ['s', 'S'], ['m', 'M'], ['l', 'L'], ['xl', 'XL'], ['xxl', 'XXL']],
    season: [['todo-el-ano', 'Todo el año'], ['verano', 'Verano'], ['otono', 'Otoño'], ['invierno', 'Invierno'], ['primavera', 'Primavera']],
  } as const;

  for (const [index, [code, name]] of simpleCatalogs.category.entries()) await prisma.category.upsert({ where: { code }, update: { name, sortOrder: index }, create: { code, name, sortOrder: index } });
  for (const [index, [code, name]] of simpleCatalogs.gender.entries()) await prisma.gender.upsert({ where: { code }, update: { name, sortOrder: index }, create: { code, name, sortOrder: index } });
  for (const [index, [code, name]] of simpleCatalogs.garmentType.entries()) await prisma.garmentType.upsert({ where: { code }, update: { name, sortOrder: index }, create: { code, name, sortOrder: index } });
  for (const [index, [code, name]] of simpleCatalogs.material.entries()) await prisma.material.upsert({ where: { code }, update: { name, sortOrder: index }, create: { code, name, sortOrder: index } });
  for (const [index, [code, name]] of simpleCatalogs.color.entries()) await prisma.color.upsert({ where: { code }, update: { name, sortOrder: index }, create: { code, name, sortOrder: index } });
  for (const [index, [code, name]] of simpleCatalogs.size.entries()) await prisma.size.upsert({ where: { code }, update: { name, sortOrder: index }, create: { code, name, sortOrder: index } });
  for (const [index, [code, name]] of simpleCatalogs.season.entries()) await prisma.season.upsert({ where: { code }, update: { name, sortOrder: index }, create: { code, name, sortOrder: index } });
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'No se pudo ejecutar el seed.');
    process.exitCode = 1;
  });
