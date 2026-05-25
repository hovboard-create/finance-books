import type { Metadata } from "next";
import Link from "next/link";
import { getAllBooks, getAllSegments } from "@/lib/db";
import { BookCard } from "@/components/BookCard";

export const metadata: Metadata = {
  title: "All Finance Books We Recommend",
  description:
    "Every personal-finance book we recommend, in one place — 25 curated picks across debt payoff, investing, early career, and entrepreneurship.",
  alternates: { canonical: "/books" },
};

export default function BooksIndexPage() {
  const books = getAllBooks();
  const segments = getAllSegments();

  return (
    <>
      <section className="border-b border-cream-200 bg-cream-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
          <p className="text-sm font-mono uppercase tracking-widest text-gold-600 mb-3">
            The full list · {books.length} books
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl font-semibold text-ink-900 leading-tight">
            Every Finance Book We Recommend
          </h1>
          <p className="mt-5 text-lg text-taupe-600 max-w-3xl leading-relaxed">
            The complete library, A–Z. Looking for something specific? Browse by where you are in your money life.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {segments.map((s) => (
              <Link
                key={s.slug}
                href={`/${s.slug}`}
                className="px-4 py-2 rounded-full bg-cream-50 border border-cream-200 hover:border-gold-400 transition-colors text-sm font-medium text-ink-700"
              >
                {s.short_name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid gap-5">
          {books.map((b) => (
            <BookCard key={b.slug} book={b} />
          ))}
        </div>
      </section>
    </>
  );
}
