export const AMAZON_TAG =
  process.env.NEXT_PUBLIC_AMAZON_TAG ?? "hovboard-20";

export function amazonProductUrl(asin: string): string {
  return `https://www.amazon.com/dp/${asin}/?tag=${AMAZON_TAG}`;
}

export function amazonSearchUrl(query: string): string {
  return `https://www.amazon.com/s?k=${encodeURIComponent(query)}&tag=${AMAZON_TAG}`;
}

export function bookAffiliateUrl(book: { asin: string | null; title: string; author: string }): string {
  if (book.asin) return amazonProductUrl(book.asin);
  return amazonSearchUrl(`${book.title} ${book.author}`);
}
