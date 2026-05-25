import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getAllSegments, getBooksForSegment, getSegment } from "@/lib/db";
import { BookCard } from "@/components/BookCard";

export function generateStaticParams() {
  return getAllSegments().map((s) => ({ segment: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ segment: string }>;
}): Promise<Metadata> {
  const { segment: slug } = await params;
  const segment = getSegment(slug);
  if (!segment) return {};
  return {
    title: segment.meta_title,
    description: segment.meta_description,
    alternates: { canonical: `/${segment.slug}` },
  };
}

export default async function SegmentPage({
  params,
}: {
  params: Promise<{ segment: string }>;
}) {
  const { segment: slug } = await params;
  const segment = getSegment(slug);
  if (!segment) notFound();
  const books = getBooksForSegment(segment.slug);
  const others = getAllSegments().filter((s) => s.slug !== segment.slug);

  return (
    <>
      <section className="border-b border-cream-200 bg-cream-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
          <p className="text-sm font-mono uppercase tracking-widest text-gold-600 mb-3">
            {segment.short_name} · {books.length} books
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl font-semibold text-ink-900 leading-tight">
            {segment.hero_headline}
          </h1>
          <p className="mt-5 text-lg text-taupe-600 max-w-3xl leading-relaxed">
            {segment.hero_subhead}
          </p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid gap-5">
          {books.map((b, i) => (
            <BookCard key={b.slug} book={b} rank={i + 1} />
          ))}
        </div>
      </section>

      <section className="border-t border-cream-200 bg-cream-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
          <h2 className="font-serif text-2xl font-semibold text-ink-900 mb-6">
            Explore other reading lists
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {others.map((s) => (
              <Link
                key={s.slug}
                href={`/${s.slug}`}
                className="p-5 rounded-lg border border-cream-200 bg-cream-50 hover:border-gold-400 transition-colors"
              >
                <p className="text-xs font-mono uppercase tracking-widest text-gold-600 mb-2">
                  {s.short_name}
                </p>
                <h3 className="font-serif text-lg font-semibold text-ink-900 leading-tight">
                  {s.name}
                </h3>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
