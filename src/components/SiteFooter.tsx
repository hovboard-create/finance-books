import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-cream-200 bg-cream-100 mt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
          <div>
            <h3 className="font-serif text-base font-semibold mb-3 text-ink-900">Collections</h3>
            <ul className="space-y-2">
              <li><Link href="/must-read" className="text-taupe-500 hover:text-ink-900">Must-Read Finance Books</Link></li>
              <li><Link href="/nyt-bestsellers" className="text-taupe-500 hover:text-ink-900">NYT Bestsellers</Link></li>
              <li><Link href="/books" className="text-taupe-500 hover:text-ink-900">All Books (A–Z)</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-serif text-base font-semibold mb-3 text-ink-900">Reading Lists</h3>
            <ul className="space-y-2">
              <li><Link href="/for-new-grads" className="text-taupe-500 hover:text-ink-900">For New Grads</Link></li>
              <li><Link href="/for-paying-off-debt" className="text-taupe-500 hover:text-ink-900">For Paying Off Debt</Link></li>
              <li><Link href="/for-beginner-investors" className="text-taupe-500 hover:text-ink-900">For Beginner Investors</Link></li>
              <li><Link href="/for-entrepreneurs" className="text-taupe-500 hover:text-ink-900">For Entrepreneurs</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-serif text-base font-semibold mb-3 text-ink-900">About</h3>
            <ul className="space-y-2">
              <li><Link href="/about" className="text-taupe-500 hover:text-ink-900">How we pick books</Link></li>
              <li><Link href="/about" className="text-taupe-500 hover:text-ink-900">Affiliate disclosure</Link></li>
            </ul>
          </div>
          <div className="col-span-2 md:col-span-1">
            <h3 className="font-serif text-base font-semibold mb-3 text-ink-900">A note on affiliate links</h3>
            <p className="text-taupe-500 leading-relaxed">
              Finance-Books.com is a participant in the Amazon Services LLC Associates Program. When you buy a book through one of our links we may earn a small commission — at no cost to you. We only recommend books we'd put on our own shelf.
            </p>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-cream-200 text-xs text-taupe-500">
          © {new Date().getFullYear()} Finance-Books.com · Curated reading for every stage of your financial life.
        </div>
      </div>
    </footer>
  );
}
