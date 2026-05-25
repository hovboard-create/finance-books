import Link from "next/link";
import { getAllSegments, getBooksForSegment, getStats } from "@/lib/db";
import { BookCard } from "@/components/BookCard";

export default function HomePage() {
  const segments = getAllSegments();
  const stats = getStats();

  return (
    <>
      <section className="border-b border-cream-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
          <p className="text-sm font-mono uppercase tracking-widest text-gold-600 mb-4">
            Curated · Honest · Practical
          </p>
          <h1 className="font-serif text-4xl sm:text-6xl font-semibold text-ink-900 leading-tight">
            The Best Finance Books<br />for Every Stage of Your Money Life
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-taupe-600 max-w-2xl mx-auto leading-relaxed">
            We've read every personal-finance book worth reading. Here are the {stats.books} we actually recommend — sorted by where you are right now, not by some generic bestseller list.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {segments.map((s) => (
              <Link
                key={s.slug}
                href={`/${s.slug}`}
                className="px-5 py-2.5 rounded-full bg-ink-900 text-cream-50 hover:bg-ink-700 transition-colors text-sm font-medium"
              >
                {s.short_name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {segments.map((segment) => {
        const books = getBooksForSegment(segment.slug).slice(0, 3);
        return (
          <section key={segment.slug} className="border-b border-cream-200">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
              <div className="flex items-end justify-between mb-8 gap-6">
                <div>
                  <p className="text-xs font-mono uppercase tracking-widest text-gold-600 mb-2">
                    {segment.short_name}
                  </p>
                  <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-ink-900">
                    {segment.name}
                  </h2>
                  <p className="mt-2 text-taupe-600 max-w-2xl">{segment.audience}</p>
                </div>
                <Link
                  href={`/${segment.slug}`}
                  className="hidden sm:inline-block text-sm font-medium text-ink-700 hover:text-gold-600 whitespace-nowrap"
                >
                  See all →
                </Link>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {books.map((b, i) => (
                  <BookCard key={b.slug} book={b} rank={i + 1} />
                ))}
              </div>
              <div className="mt-6 sm:hidden">
                <Link
                  href={`/${segment.slug}`}
                  className="text-sm font-medium text-ink-700 hover:text-gold-600"
                >
                  See all {segment.short_name.toLowerCase()} picks →
                </Link>
              </div>
            </div>
          </section>
        );
      })}
    </>
  );
}
