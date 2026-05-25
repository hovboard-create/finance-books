import Link from "next/link";
import Image from "next/image";
import type { Book } from "@/lib/schema";
import { AmazonButton } from "./AmazonButton";

export function BookCard({ book, rank }: { book: Book; rank?: number }) {
  return (
    <article className="flex gap-5 p-5 bg-cream-100 rounded-lg border border-cream-200 hover:border-gold-400 transition-colors">
      <Link
        href={`/books/${book.slug}`}
        className="flex-shrink-0 book-cover rounded overflow-hidden w-24 sm:w-28 h-36 sm:h-40 relative"
      >
        {book.cover_url ? (
          <Image
            src={book.cover_url}
            alt={`${book.title} book cover`}
            fill
            sizes="(min-width: 640px) 7rem, 6rem"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-taupe-500 text-xs p-2 text-center">
            {book.title}
          </div>
        )}
      </Link>
      <div className="flex-1 min-w-0">
        {rank && (
          <div className="text-xs font-mono text-gold-600 mb-1">#{rank} · Editor's Pick</div>
        )}
        <h3 className="font-serif text-xl font-semibold text-ink-900 leading-tight">
          <Link href={`/books/${book.slug}`} className="hover:text-gold-600 transition-colors">
            {book.title}
          </Link>
        </h3>
        <p className="text-sm text-taupe-500 mt-1">by {book.author}{book.year ? ` · ${book.year}` : ""}</p>
        {book.amazon_rating ? (
          <div className="text-sm mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1">
              <span className="text-gold-500">★</span>
              <span className="font-medium text-ink-900">{book.amazon_rating.toFixed(1)}</span>
              {book.amazon_rating_count && (
                <span className="text-taupe-500">
                  ({book.amazon_rating_count.toLocaleString()})
                </span>
              )}
            </span>
            {book.amazon_price_display && (
              <span className="text-ink-700 font-medium">{book.amazon_price_display}</span>
            )}
          </div>
        ) : book.goodreads_rating ? (
          <div className="text-sm mt-2 flex items-center gap-1">
            <span className="text-gold-500">★</span>
            <span className="font-medium text-ink-900">{book.goodreads_rating.toFixed(1)}</span>
            <span className="text-taupe-500">our take</span>
          </div>
        ) : null}
        {book.takeaway && (
          <p className="text-sm mt-3 text-ink-700 line-clamp-3 leading-relaxed">{book.takeaway}</p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <AmazonButton book={book} size="sm" />
          <Link
            href={`/books/${book.slug}`}
            className="text-sm font-medium text-ink-700 hover:text-gold-600"
          >
            Read more →
          </Link>
        </div>
      </div>
    </article>
  );
}
