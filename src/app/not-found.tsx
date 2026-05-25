import Link from "next/link";

export default function NotFound() {
  return (
    <section className="max-w-2xl mx-auto px-4 sm:px-6 py-24 text-center">
      <p className="text-sm font-mono uppercase tracking-widest text-gold-600 mb-4">404</p>
      <h1 className="font-serif text-4xl font-semibold text-ink-900">Page not found</h1>
      <p className="mt-4 text-taupe-600">
        That page doesn't exist — but our reading lists do.
      </p>
      <Link
        href="/"
        className="inline-block mt-8 px-6 py-3 rounded-full bg-ink-900 text-cream-50 hover:bg-ink-700 transition-colors"
      >
        Back to home
      </Link>
    </section>
  );
}
