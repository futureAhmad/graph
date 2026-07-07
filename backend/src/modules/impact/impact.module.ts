import { Module } from "@nestjs/common";
import { GraphModule } from "../graph/graph.module";
import { ImpactController } from "./impact.controller";
import { ImpactService } from "./impact.service";

@Module({
  imports: [GraphModule],
  controllers: [ImpactController],
  providers: [ImpactService]
})
export class ImpactModule {}
