import { Module } from "@nestjs/common";
import { GraphModule } from "../graph/graph.module";
import { ServiceController } from "./service.controller";
import { ServiceDependencyService } from "./service.service";

@Module({
  imports: [GraphModule],
  controllers: [ServiceController],
  providers: [ServiceDependencyService]
})
export class ServiceModule {}
