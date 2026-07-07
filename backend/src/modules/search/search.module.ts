import { Module } from "@nestjs/common";
import { GraphModule } from "../graph/graph.module";
import { SearchController } from "./search.controller";
import { SearchService } from "./search.service";

@Module({
  imports: [GraphModule],
  controllers: [SearchController],
  providers: [SearchService]
})
export class SearchModule {}
