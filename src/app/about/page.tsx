import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About & Affiliate Disclosure",
  description:
    "How Finance-Books.com selects books, our editorial process, and our Amazon Associates affiliate disclosure.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
      <h1 className="font-serif text-4xl sm:text-5xl font-semibold text-ink-900">
        About Finance-Books.com
      </h1>
      <div className="prose prose-editorial mt-8 max-w-none text-ink-700 leading-relaxed">
        <p>
          Finance-Books.com is a curated reading guide to the best personal-finance books — sorted by where you are in your money life, not by a generic bestseller list.
        </p>

        <h2 className="font-serif text-2xl font-semibold text-ink-900 mt-10">How we pick books</h2>
        <p>
          Every book on this site has been read by at least one of our editors and judged on three criteria: <strong>practical applicability</strong> (does the advice work for normal people?), <strong>honesty</strong> (does the author make money on their advice, or from selling the book?), and <strong>staying power</strong> (will this still be useful in five years?).
        </p>
        <p>
          We include a few divisive picks — <em>Rich Dad Poor Dad</em>, <em>The Total Money Makeover</em> — because they're the books people are searching for. Our editorial notes flag what's useful and what to ignore.
        </p>

        <h2 id="how-we-rate" className="font-serif text-2xl font-semibold text-ink-900 mt-10">How we rate</h2>
        <p>
          The star rating next to each book is <strong>our take</strong>, not an Amazon star average. We rate on a 5-point scale that weighs the book's quality against the alternatives in its category. A 4.5 from us means we'd put it on a friend's shelf without hesitation. A 3.5 means it's worth reading with caveats — which we'll spell out in the book's notes.
        </p>
        <p>
          Why our own rating rather than Amazon's? Three reasons. First, Amazon's Product Advertising API isn't available to small affiliate sites until they've generated 10 qualifying sales in the trailing 30 days — so the cleanest path for a curated site is to own the rating outright. Second, Amazon star averages over-weight recent purchasers who haven't finished the book. Third, our editorial position is the actual product here; aggregated stars from strangers aren't.
        </p>
        <p>
          For a book's <em>live</em> rating, price, and availability, click through to Amazon — we link to the current product page on every recommendation.
        </p>

        <h2 className="font-serif text-2xl font-semibold text-ink-900 mt-10">Affiliate disclosure</h2>
        <p>
          Finance-Books.com is a participant in the Amazon Services LLC Associates Program, an affiliate advertising program designed to provide a means for sites to earn advertising fees by advertising and linking to Amazon.com.
        </p>
        <p>
          When you buy a book through one of our links, we earn a small commission — typically about 4.5% of the sale price. The price you pay is the same whether you click through us or go to Amazon directly. We only recommend books we'd put on our own shelf.
        </p>

        <h2 className="font-serif text-2xl font-semibold text-ink-900 mt-10">Editorial independence</h2>
        <p>
          We don't accept paid placements, sponsored reviews, or "submitted for review" copies. Authors and publishers do not influence our rankings. If we wouldn't read it twice, it doesn't make the list.
        </p>
      </div>
    </section>
  );
}
