import Link from "next/link";

export function NavHeader() {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Receipt Parser
        </Link>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground sm:gap-6">
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
