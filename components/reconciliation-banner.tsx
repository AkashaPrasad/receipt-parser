import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { Reconciliation } from "@/lib/types";

export function ReconciliationBanner({
  reconciliation,
  currency,
}: {
  reconciliation: Reconciliation | null;
  currency: string | null;
}) {
  if (!reconciliation) {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="size-4" />
        <span>Line items reconcile with the total.</span>
      </div>
    );
  }

  const unaccounted = formatCurrency(Math.abs(reconciliation.delta), currency);
  const itemsSum = formatCurrency(reconciliation.items_sum, currency);
  const statedTotal = formatCurrency(reconciliation.stated_total, currency);

  return (
    <Alert className="border-amber-500/50 text-amber-800 dark:text-amber-300 [&>svg]:text-amber-600">
      <AlertTriangle className="size-4" />
      <AlertTitle>Numbers don&apos;t add up</AlertTitle>
      <AlertDescription className="text-amber-800/90 dark:text-amber-300/90">
        Line items sum to {itemsSum} but the receipt total reads {statedTotal} ({unaccounted} unaccounted).
      </AlertDescription>
    </Alert>
  );
}
