import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { GraphModule } from "./modules/graph/graph.module";
import { ImpactModule } from "./modules/impact/impact.module";
import { ImportModule } from "./modules/import/import.module";
import { PostgresModule } from "./modules/postgres/postgres.module";
import { SearchModule } from "./modules/search/search.module";
import { ServiceModule } from "./modules/service/service.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PostgresModule,
    GraphModule,
    ImportModule,
    ImpactModule,
    ServiceModule,
    SearchModule
  ]
})
export class AppModule {}
