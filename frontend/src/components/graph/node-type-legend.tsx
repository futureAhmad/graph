import { Badge } from "@/components/ui/badge";
import { NODE_COLORS } from "./node-colors";

export function NodeTypeLegend() {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(NODE_COLORS).map(([type, color]) => (
        <Badge key={type} className="gap-2 border-white/10 bg-white/[0.04]">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
          {type}
        </Badge>
      ))}
    </div>
  );
}
