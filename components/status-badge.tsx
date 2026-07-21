import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: "parsed" | "corrected" }) {
  if (status === "corrected") {
    return (
      <Badge variant="outline" className="border-emerald-600/40 text-emerald-700 dark:text-emerald-400">
        Corrected
      </Badge>
    );
  }
  return <Badge variant="secondary">Parsed</Badge>;
}

export function FlagBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-400">
      {count} flag{count === 1 ? "" : "s"}
    </Badge>
  );
}
