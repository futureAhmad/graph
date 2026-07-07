import { Injectable } from "@nestjs/common";
import { GraphRepository } from "../graph/graph.repository";
import { SearchQueryDto } from "./dto/search-query.dto";

@Injectable()
export class SearchService {
  constructor(private readonly graphRepository: GraphRepository) {}

  search(query: SearchQueryDto) {
    return this.graphRepository.search(query.q, query.datasetId, query.limit);
  }
}
