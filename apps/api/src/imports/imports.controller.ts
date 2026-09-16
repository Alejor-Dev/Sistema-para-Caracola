import { Body, Controller, Get, Post, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import type { RequestUser } from '../common/request-user';
import { Permissions } from '../iam/permissions.decorator';
import { ConfirmProductImportDto } from './import.dto';
import { ImportsService } from './imports.service';
type AuthenticatedRequest=Request&{user:RequestUser;id?:string};
@Controller('imports/products')
export class ImportsController{
  constructor(private readonly imports:ImportsService){}
  @Get('template') @Permissions('imports.create') template(@Res() response:Response){response.setHeader('content-type','text/csv; charset=utf-8');response.setHeader('content-disposition','attachment; filename="plantilla-productos.csv"');response.send(this.imports.template());}
  @Post('preview') @Permissions('imports.create') @UseInterceptors(FileInterceptor('file',{limits:{fileSize:5*1024*1024,files:1}})) preview(@UploadedFile() file:Express.Multer.File|undefined,@Req() request:AuthenticatedRequest){return this.imports.preview(file,this.context(request));}
  @Post('confirm') @Permissions('imports.create') confirm(@Body() input:ConfirmProductImportDto,@Req() request:AuthenticatedRequest){return this.imports.confirm(input.importId,this.context(request));}
  private context(request:AuthenticatedRequest){return{actor:request.user,ip:request.ip,userAgent:request.get('user-agent'),requestId:request.id};}
}
