import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  getAllBooks,
  getBookWithSegments,
  getRelatedBooks,
  getSegment,
} from "@/lib/db";
import { AmazonButton } from "@/components/AmazonButton";
import { BookCard } from "@/components/BookCard";

export function generateStaticParams() {
  return getAllBooks().map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const book = getBookWithSegments(slug);
  if (!book) return {};
  return {
    title: `${book.title} by ${book.author} — Review & Key Lessons`,
    description:
      book.takeaway?.slice(0, 155) ??
      `Read our editorial review of ${book.title} by ${book.author}. Key takeaways, who it's for, and where to buy.`,
    alternates: { canonical: `/books/${book.slug}` },
  };
}

export default async function BookPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const book = getBookWithSegments(slug);
  if (!book) notFound();
  const related = getRelatedBooks(book.slug, 4);
  const segments = book.segment_slugs
    .map((s) => getSegment(s))
    .filter((s): s is NonNullable<typeof s> => s !== null);

  return (
    <>
      <section className="border-b border-cream-200 bg-cream-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <nav className="text-sm text-taupe-500 mb-6 flex gap-2 items-center">
            <Link href="/" className="hover:text-ink-900">Home</Link>
            <span>/</span>
            <Link href="/books" className="hover:text-ink-900">Books</Link>
            <span>/</span>
            <span className="text-ink-700">{book.title}</span>
          </nav>
          <div className="grid sm:grid-cols-[14rem_1fr] gap-10">
            <div className="book-cover rounded overflow-hidden w-full max-w-56 aspect-[2/3] relative">
              {book.cover_url ? (
                <Image
                  src={book.cover_url}
                  alt={`${book.title} cover`}
                  fill
                  priority
                  sizes="14rem"
                  className="object-cover"
                />
              ) : null}
            </div>
            <div>
              {segments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {segments.map((s) => (
                    <Link
                      key={s.slug}
                      href={`/${s.slug}`}
                      className="text-xs font-mono uppercase tracking-widest text-gold-600 hover:text-gold-700 border border-gold-400 rounded-full px-3 py-1"
                    >
                      {s.short_name}
                    </Link>
                  ))}
                </div>
              )}
              <h1 className="font-serif text-3xl sm:text-5xl font-semibold text-ink-900 leading-tight">
                {book.title}
              </h1>
              {book.subtitle && (
                <p className="mt-2 font-serif text-xl text-taupe-600 italic">
                  {book.subtitle}
                </p>
              )}
              <p className="mt-4 text-lg text-ink-700">
                by <span className="font-medium">{book.author}</span>
                {book.year ? <> · {book.year}</> : null}
                {book.pages ? <> · {book.pages} pages</> : null}
              </p>
              {book.amazon_rating ? (
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="text-gold-500 text-lg">★</span>
                    <span className="font-semibold text-ink-900 text-base">
                      {book.amazon_rating.toFixed(1)}
                    </span>
                    {book.amazon_rating_count && (
                      <span className="text-taupe-500">
                        ({book.amazon_rating_count.toLocaleString()} ratings)
                      </span>
                    )}
                  </span>
                  <span className="text-taupe-500">on Amazon</span>
                </div>
              ) : book.goodreads_rating ? (
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <span className="text-gold-500 text-lg">★</span>
                  <span className="font-semibold text-ink-900 text-base">
                    {book.goodreads_rating.toFixed(1)}
                  </span>
                  <span className="text-taupe-500">
                    Our take · <a href="/about" className="underline hover:text-ink-900">how we rate</a>
                  </span>
                </div>
              ) : null}
              <div className="mt-6">
                <AmazonButton book={book} size="lg" label="Buy on Amazon" />
                <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  {book.amazon_price_display && (
                    <span className="text-lg font-semibold text-ink-900">
                      {book.amazon_price_display}
                    </span>
                  )}
                  {book.amazon_availability && (
                    <span className="text-sm text-taupe-500">{book.amazon_availability}</span>
                  )}
                </div>
                <p className="text-xs text-taupe-500 mt-2">
                  {book.amazon_updated_at ? (
                    <>
                      Price &amp; rating from Amazon, updated{" "}
                      {new Date(book.amazon_updated_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      . Current price &amp; availability shown on Amazon at checkout.
                    </>
                  ) : (
                    <>We earn a small commission if you buy through this link — no cost to you.</>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        {book.takeaway ? (
          <div className="prose prose-editorial max-w-none">
            <h2 className="font-serif text-2xl font-semibold text-ink-900 mb-4">
              What this book is really about
            </h2>
            <p className="text-lg text-ink-700 leading-relaxed">{book.takeaway}</p>
            {book.buy_warning && (
              <aside className="not-prose mt-6 p-5 rounded-lg bg-amber-50 border-l-4 border-amber-500">
                <p className="text-sm font-mono uppercase tracking-widest text-amber-700 mb-2">
                  Read with caveats
                </p>
                <p className="text-ink-700 leading-relaxed">{book.buy_warning}</p>
              </aside>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-cream-300 p-8 text-center bg-cream-100">
            <p className="text-taupe-500 italic">
              Our editorial review of <span className="font-semibold text-ink-900">{book.title}</span> is being written. Check back soon.
            </p>
            <div className="mt-4">
              <AmazonButton book={book} label="View on Amazon" />
            </div>
          </div>
        )}

        {book.key_lessons && (
          <div className="mt-10">
            <h2 className="font-serif text-2xl font-semibold text-ink-900 mb-4">
              Key lessons
            </h2>
            <div className="prose max-w-none text-ink-700">
              {book.key_lessons.split("\n").filter(Boolean).map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>
        )}

        {book.who_its_for && (
          <div className="mt-10 p-6 rounded-lg bg-cream-100 border-l-4 border-gold-500">
            <h3 className="font-serif text-xl font-semibold text-ink-900 mb-2">
              Who it's for
            </h3>
            <p className="text-ink-700">{book.who_its_for}</p>
          </div>
        )}

        {book.youtube_id && (
          <div className="mt-10">
            <h2 className="font-serif text-2xl font-semibold text-ink-900 mb-4">
              Watch: author talk
            </h2>
            <div className="aspect-video rounded overflow-hidden">
              <iframe
                src={`https://www.youtube.com/embed/${book.youtube_id}`}
                title={`${book.title} - author interview`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          </div>
        )}

        <div className="mt-12 p-6 rounded-lg bg-ink-900 text-cream-50 text-center">
          <p className="font-serif text-xl mb-3">Ready to read it?</p>
          <AmazonButton book={book} size="lg" label="Buy on Amazon" />
        </div>
      </section>

      {related.length > 0 && (
        <section className="border-t border-cream-200 bg-cream-100">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
            <h2 className="font-serif text-2xl font-semibold text-ink-900 mb-6">
              If you liked this, try…
            </h2>
            <div className="grid sm:grid-cols-2 gap-5">
              {related.map((b) => (
                <BookCard key={b.slug} book={b} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
