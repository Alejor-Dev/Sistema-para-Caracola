import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductImagesService } from './product-images.service';

@Module({ controllers: [ProductsController], providers: [ProductsService, ProductImagesService] })
export class ProductsModule {}
