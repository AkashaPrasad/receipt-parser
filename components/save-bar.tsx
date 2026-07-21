import { Button } from "@/components/ui/button";

export function SaveBar({
  dirty,
  saving,
  onSave,
  onDiscard,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {dirty && <span className="size-1.5 rounded-full bg-primary" aria-hidden />}
        {dirty ? "Unsaved changes" : "All changes saved"}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onDiscard} disabled={!dirty || saving}>
          Discard changes
        </Button>
        <Button size="sm" onClick={onSave} disabled={!dirty || saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
