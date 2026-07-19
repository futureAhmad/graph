import { Body, Controller, Delete, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { ImportRequestDto } from "./dto/import-request.dto";
import { ImportService } from "./import.service";

@ApiTags("import")
@Controller("import")
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post()
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: { type: "string", format: "binary" },
        sourceName: { type: "string" }
      },
      required: ["file"]
    }
  })
  @UseInterceptors(FileInterceptor("file"))
  import(@UploadedFile() file: Express.Multer.File, @Body() body: ImportRequestDto) {
    return this.importService.importWorkbook(file, body);
  }

  @Delete()
  deleteImportedData() {
    return this.importService.deleteImportedData();
  }
}
