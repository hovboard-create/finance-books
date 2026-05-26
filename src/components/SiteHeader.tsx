import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-cream-200 bg-cream-50/80 backdrop-blur sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-6">
        <Link href="/" className="flex items-baseline gap-1.5 group self-center sm:self-auto">
          <span className="font-serif text-xl sm:text-2xl font-semibold text-ink-900 group-hover:text-gold-600 transition-colors">
            Finance-Books
          </span>
          <span className="text-xs text-taupe-500">.com</span>
        </Link>
        <nav className="flex items-center justify-center flex-wrap gap-x-1 gap-y-1 sm:gap-3 text-sm font-medium">
          <Link
            href="/must-read"
            className="px-2 sm:px-3 py-1.5 rounded-md text-gold-700 font-semibold hover:text-gold-600 hover:bg-cream-100 transition-colors whitespace-nowrap"
          >
            Must-Read
          </Link>
          <Link
            href="/nyt-bestsellers"
            className="px-2 sm:px-3 py-1.5 rounded-md text-gold-700 font-semibold hover:text-gold-600 hover:bg-cream-100 transition-colors whitespace-nowrap"
          >
            Bestsellers
          </Link>
          <span className="hidden sm:inline text-cream-300" aria-hidden="true">·</span>
          <Link
            href="/for-new-grads"
            className="px-2 sm:px-3 py-1.5 rounded-md text-ink-700 hover:text-ink-900 hover:bg-cream-100 transition-colors whitespace-nowrap"
          >
            New Grads
          </Link>
          <Link
            href="/for-paying-off-debt"
            className="px-2 sm:px-3 py-1.5 rounded-md text-ink-700 hover:text-ink-900 hover:bg-cream-100 transition-colors whitespace-nowrap"
          >
            Debt Payoff
          </Link>
          <Link
            href="/for-beginner-investors"
            className="px-2 sm:px-3 py-1.5 rounded-md text-ink-700 hover:text-ink-900 hover:bg-cream-100 transition-colors whitespace-nowrap"
          >
            Investing
          </Link>
          <Link
            href="/for-entrepreneurs"
            className="px-2 sm:px-3 py-1.5 rounded-md text-ink-700 hover:text-ink-900 hover:bg-cream-100 transition-colors whitespace-nowrap"
          >
            Entrepreneurs
          </Link>
        </nav>
      </div>
    </header>
  );
}
