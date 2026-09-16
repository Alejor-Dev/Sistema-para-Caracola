import { Body, Controller, Delete, Get, Header, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import type { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import type { RequestUser } from '../common/request-user';
import { Permissions } from '../iam/permissions.decorator';
import { CreateProductDto, CreateVariantDto, PricingQueryDto, ProductQueryDto, UpdateProductDto, UpdateVariantDto } from './product.dto';
import { ProductsService } from './products.service';
import { ProductImagesService } from './product-images.service';

type AuthenticatedRequest = Request & { user: RequestUser; id?: string };

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService, private readonly images: ProductImagesService) {}

  @Get('pricing/calculate') @Permissions('products.read')
  pricing(@Query() input: PricingQueryDto) { return this.products.calculatePricing(input); }

  @Get() @Permissions('products.read')
  list(@Query() query: ProductQueryDto, @Req() request: AuthenticatedRequest) { return this.products.list(query, request.user); }

  @Get(':id') @Permissions('products.read')
  get(@Param('id', new ParseUUIDPipe()) id: string, @Req() request: AuthenticatedRequest) { return this.products.get(id, request.user); }

  @Get('images/:id/content') @Permissions('products.read') @Header('Cache-Control', 'private, max-age=86400')
  async image(@Param('id', new ParseUUIDPipe()) id: string) { const result = await this.images.content(id); return new StreamableFile(result.buffer, { type: result.image.mimeType, length: result.image.byteSize }); }

  @Post() @Permissions('products.create')
  create(@Body() input: CreateProductDto, @Req() request: AuthenticatedRequest) { return this.products.create(input, this.context(request)); }

  @Post(':id/variants') @Permissions('products.create')
  addVariant(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: CreateVariantDto, @Req() request: AuthenticatedRequest) { return this.products.addVariant(id, input, this.context(request)); }

  @Post(':id/images') @Permissions('products.update') @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 8 * 1024 * 1024, files: 1 } }))
  uploadImage(@Param('id', new ParseUUIDPipe()) id: string, @Query('variantId') variantId: string | undefined, @UploadedFile() file: Express.Multer.File | undefined, @Req() request: AuthenticatedRequest) {
    return this.images.upload(id, variantId, file, this.context(request));
  }

  @Patch(':id') @Permissions('products.update')
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: UpdateProductDto, @Req() request: AuthenticatedRequest) { return this.products.update(id, input, this.context(request)); }

  @Patch('variants/:id') @Permissions('prices.update')
  updateVariant(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: UpdateVariantDto, @Req() request: AuthenticatedRequest) { return this.products.updateVariant(id, input, this.context(request)); }

  @Delete(':id') @HttpCode(204) @Permissions('products.archive')
  archive(@Param('id', new ParseUUIDPipe()) id: string, @Req() request: AuthenticatedRequest) { return this.products.archive(id, this.context(request)); }

  private context(request: AuthenticatedRequest) { return { actor: request.user, ip: request.ip, userAgent: request.get('user-agent'), requestId: request.id }; }
}
