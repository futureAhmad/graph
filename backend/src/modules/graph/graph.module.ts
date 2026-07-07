import { Module } from "@nestjs/common";
import { GraphController } from "./graph.controller";
import { GraphRepository } from "./graph.repository";
import { GraphService } from "./graph.service";

@Module({
  controllers: [GraphController],
  providers: [GraphRepository, GraphService],
  exports: [GraphRepository, GraphService]
})
export class GraphModule {}
