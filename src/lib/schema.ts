export type Segment = {
  slug: string;
  kind: "audience" | "collection";
  name: string;
  short_name: string;
  audience: string;
  hero_headline: string;
  hero_subhead: string;
  meta_title: string;
  meta_description: string;
  sort_order: number;
};

export type Book = {
  slug: string;
  title: string;
  subtitle: string | null;
  author: string;
  asin: string | null;
  isbn13: string | null;
  year: number | null;
  pages: number | null;
  goodreads_rating: number | null;
  cover_url: string | null;
  takeaway: string | null;
  key_lessons: string | null;
  who_its_for: string | null;
  youtube_id: string | null;
  buy_warning: string | null;
  // Amazon PA-API data — refreshed via scripts/refresh-amazon.ts
  // and merged in at ETL time. Null until first refresh.
  amazon_rating: number | null;
  amazon_rating_count: number | null;
  amazon_price: number | null;
  amazon_price_display: string | null;
  amazon_availability: string | null;
  amazon_updated_at: string | null;
};

export type BookWithSegments = Book & { segment_slugs: string[] };
