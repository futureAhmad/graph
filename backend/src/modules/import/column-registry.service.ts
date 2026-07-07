import {
  CANONICAL_NODE_TYPES,
  KNOWN_COLUMN_TYPE_MAP,
  RELATIONSHIP_TYPES
} from "@service-dependency/shared";
import { Injectable } from "@nestjs/common";
import { normalizeHeader, toPascalIdentifier } from "../../common/utils/text-normalizer";

export interface ResolvedColumn {
  originalHeader: string;
  normalizedHeader: string;
  nodeType: string;
  relationshipType?: string;
  isServiceColumn: boolean;
}

@Injectable()
export class ColumnRegistryService {
  resolve(header: string): ResolvedColumn {
    const normalizedHeader = normalizeHeader(header);
    const nodeType = KNOWN_COLUMN_TYPE_MAP[normalizedHeader] ?? toPascalIdentifier(normalizedHeader);
    const isServiceColumn = nodeType === CANONICAL_NODE_TYPES.SERVICE;

    return {
      originalHeader: header,
      normalizedHeader,
      nodeType,
      relationshipType: isServiceColumn ? undefined : this.relationshipTypeForNodeType(nodeType),
      isServiceColumn
    };
  }

  relationshipTypeForNodeType(nodeType: string): string {
    if (nodeType === CANONICAL_NODE_TYPES.FUNCTION) {
      return RELATIONSHIP_TYPES.HAS_FUNCTION;
    }

    if (nodeType === CANONICAL_NODE_TYPES.DIRECT_CHANNEL) {
      return RELATIONSHIP_TYPES.AVAILABLE_ON;
    }

    return RELATIONSHIP_TYPES.DEPENDS_ON;
  }
}
