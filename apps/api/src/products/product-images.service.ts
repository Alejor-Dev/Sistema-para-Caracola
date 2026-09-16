import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import sharp from 'sharp';
import type { ActionContext } from '../iam/users.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductImagesService {
  private readonly root = resolve(process.env.PRODUCT_IMAGES_DIR ?? join(process.cwd(), 'data', 'product-images'));

  constructor(private readonly prisma: PrismaService) {}

  async upload(productId: string, variantId: string | undefined, file: Express.Multer.File | undefined, context: ActionContext) {
    if (!file) throw new BadRequestException('Debe seleccionar una imagen.');
    if (variantId && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(variantId)) throw new BadRequestException('La variante no es válida.');
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/octet-stream'].includes(file.mimetype)) throw new BadRequestException('Formato no permitido. Use JPG, PNG o WebP.');
    const product = await this.prisma.product.findFirst({ where: { id: productId, archivedAt: null }, select: { id: true } });
    if (!product) throw new NotFoundException('El producto no existe.');
    if (variantId && !(await this.prisma.productVariant.findFirst({ where: { id: variantId, productId, archivedAt: null }, select: { id: true } }))) throw new BadRequestException('La variante no pertenece al producto.');

    let output: Buffer;
    try {
      output = await sharp(file.buffer, { failOn: 'warning', limitInputPixels: 40_000_000 }).rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 82, effort: 4 }).toBuffer();
    } catch { throw new BadRequestException('La imagen está dañada o no se puede procesar.'); }
    const metadata = await sharp(output).metadata();
    if (!metadata.width || !metadata.height) throw new BadRequestException('No se pudieron validar las dimensiones.');
    const storageKey = `${productId}/${randomUUID()}.webp`;
    const path = this.safePath(storageKey);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, output, { flag: 'wx' });
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.productImage.count({ where: { productId } });
        const image = await tx.productImage.create({ data: { productId, variantId, storageKey, mimeType: 'image/webp', width: metadata.width!, height: metadata.height!, byteSize: output.length, checksum: createHash('sha256').update(output).digest('hex'), isPrimary: existing === 0 } });
        await tx.auditLog.create({ data: { actorUserId: context.actor.id, action: 'product.image_added', entityType: 'product', entityId: productId, afterData: { imageId: image.id, byteSize: image.byteSize }, ip: context.ip, userAgent: context.userAgent?.slice(0, 512), requestId: context.requestId } });
        return image;
      });
    } catch (error) { await unlink(path).catch(() => undefined); throw error; }
  }

  async content(id: string) {
    const image = await this.prisma.productImage.findUnique({ where: { id } });
    if (!image) throw new NotFoundException('La imagen no existe.');
    try { return { image, buffer: await readFile(this.safePath(image.storageKey)) }; }
    catch { throw new NotFoundException('El archivo de imagen no está disponible.'); }
  }

  private safePath(storageKey: string) {
    const path = resolve(this.root, storageKey);
    if (!path.startsWith(`${this.root}${sep}`) && path !== this.root) throw new BadRequestException('Ruta de imagen inválida.');
    return path;
  }
}
