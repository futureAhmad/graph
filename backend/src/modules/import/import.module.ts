import { Module } from "@nestjs/common";
import { GraphModule } from "../graph/graph.module";
import { ColumnRegistryService } from "./column-registry.service";
import { ImportController } from "./import.controller";
import { ImportService } from "./import.service";

@Module({
  imports: [GraphModule],
  controllers: [ImportController],
  providers: [ColumnRegistryService, ImportService]
})
export class ImportModule {}
