import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImageOff } from "lucide-react";

export function NotAReceiptCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Card className="mx-auto max-w-md border-dashed">
      <CardHeader className="items-center text-center">
        <ImageOff className="mb-2 size-8 text-muted-foreground" aria-hidden />
        <CardTitle>{message}</CardTitle>
        <CardDescription>Try a clear, well-lit photo of the whole receipt.</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        <Button onClick={onRetry}>Try another photo</Button>
      </CardContent>
    </Card>
  );
}
