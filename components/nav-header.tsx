import Link from "next/link";

export function NavHeader() {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Receipt Parser
        </Link>
        <nav className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            Upload
          </Link>
          <Link href="/receipts" className="hover:text-foreground">
            All receipts
          </Link>
        </nav>
      </div>
    </header>
  );
}
