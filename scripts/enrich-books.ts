import axios from 'axios';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { promisify } from 'util';

const sleep = promisify(setTimeout);

interface DiscoveredBook {
  title: string;
  author: string;
  isbn13?: string;
  asin?: string;
  source: string;
  confidence: number;
}

interface EnrichedBook {
  slug: string;
  title: string;
  author: string;
  asin?: string;
  isbn13?: string;
  year?: number;
  pages?: number;
  goodreads_rating?: number;
  cover_url?: string;
  youtube_id?: null;
  ol_cover_id?: number;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

async function fetchOpenLibraryData(isbn: string): Promise<Partial<EnrichedBook>> {
  try {
    const response = await axios.get(`https://openlibrary.org/isbn/${isbn}.json`, {
      timeout: 3000,
    });

    const data = response.data;
    return {
      isbn13: isbn,
      year: data.publish_date ? parseInt(data.publish_date.split(' ').pop()) : undefined,
      pages: data.number_of_pages,
      cover_url: `https://covers.openlibrary.org/b/id/${data.covers?.[0]}-L.jpg`,
      ol_cover_id: data.covers?.[0],
    };
  } catch (error) {
    return {};
  }
}

async function fetchGoodreadsData(title: string, author: string): Promise<Partial<EnrichedBook>> {
  try {
    const apiKey = process.env.GOODREADS_API_KEY;
    if (!apiKey) return {};

    // Note: Goodreads API is deprecated but still works for read-only
    const response = await axios.get(
      `https://www.goodreads.com/search/index.xml?key=${apiKey}&q=${encodeURIComponent(title + ' ' + author)}`,
      { timeout: 3000 }
    );

    // Parse XML (simple extraction)
    const ratingMatch = response.data.match(/<average_rating>([^<]+)<\/average_rating>/);
    const isbnMatch = response.data.match(/<isbn13>([^<]+)<\/isbn13>/);

    return {
      goodreads_rating: ratingMatch ? parseFloat(ratingMatch[1]) : undefined,
      isbn13: isbnMatch ? isbnMatch[1] : undefined,
    };
  } catch (error) {
    return {};
  }
}

async function fetchAmazonASIN(title: string, author: string): Promise<string | undefined> {
  try {
    // Using Amazon Product Advertising API would require AWS credentials
    // Alternative: simple heuristic or Amazon search scrape
    // For now, we'll skip ASIN fetching and let it be filled manually or via separate process
    return undefined;
  } catch (error) {
    return undefined;
  }
}

async function enrichBook(book: DiscoveredBook): Promise<EnrichedBook | null> {
  try {
    let enriched: EnrichedBook = {
      slug: slugify(book.title),
      title: book.title,
      author: book.author,
      youtube_id: null,
    };

    // Try to get ISBN and enrich from Open Library
    const isbn = book.isbn13 || (await findISBNFromTitle(book.title, book.author));
    if (isbn) {
      const olData = await fetchOpenLibraryData(isbn);
      enriched = { ...enriched, ...olData };
    }

    // Try Goodreads
    const grData = await fetchGoodreadsData(book.title, book.author);
    enriched = { ...enriched, ...grData };

    // Try Amazon ASIN
    const asin = book.asin || (await fetchAmazonASIN(book.title, book.author));
    if (asin) enriched.asin = asin;

    // Rate limit: Goodreads allows ~1 req/sec
    await sleep(500);

    return enriched;
  } catch (error) {
    console.error(`Failed to enrich "${book.title}":`, (error as Error).message);
    return null;
  }
}

async function findISBNFromTitle(title: string, author: string): Promise<string | undefined> {
  try {
    // Use Open Library search to find ISBN
    const response = await axios.get(
      `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}&limit=1`,
      { timeout: 3000 }
    );

    const firstResult = response.data.docs?.[0];
    return firstResult?.isbn?.[0];
  } catch (error) {
    return undefined;
  }
}

async function main() {
  console.log('🔧 Starting book enrichment...\n');

  // Try discovered-books.json first, then bulk-import-books.json
  let discoveredPath = path.join(process.cwd(), 'data', 'discovered-books.json');
  let discovered: DiscoveredBook[];

  try {
    discovered = JSON.parse(readFileSync(discoveredPath, 'utf-8'));
  } catch {
    // Fallback to bulk import
    discoveredPath = path.join(process.cwd(), 'data', 'bulk-import-books.json');
    console.log('📌 Using bulk-import-books.json instead...\n');
    discovered = JSON.parse(readFileSync(discoveredPath, 'utf-8'));
  }

  console.log(`📚 Enriching ${discovered.length} books...\n`);

  const enriched: EnrichedBook[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < discovered.length; i++) {
    const book = discovered[i];
    console.log(`[${i + 1}/${discovered.length}] Enriching: ${book.title}`);

    const enrichedBook = await enrichBook(book);
    if (enrichedBook) {
      enriched.push(enrichedBook);
      successCount++;
      console.log(`  ✓ Success (ISBN: ${enrichedBook.isbn13 || 'N/A'}, Rating: ${enrichedBook.goodreads_rating || 'N/A'})`);
    } else {
      failureCount++;
      console.log(`  ✗ Failed`);
    }
  }

  // Write results
  const outputPath = path.join(process.cwd(), 'data', 'enriched-books.json');
  writeFileSync(outputPath, JSON.stringify(enriched, null, 2));

  console.log(`\n📊 Summary:`);
  console.log(`   Total: ${discovered.length}`);
  console.log(`   ✓ Enriched: ${successCount}`);
  console.log(`   ✗ Failed: ${failureCount}`);
  console.log(`\n✅ Results saved to: ${outputPath}`);

  if (enriched.length > 0) {
    console.log(`\n📖 Enriched books ready for editorial generation:`);
    enriched.forEach((book) => {
      console.log(
        `   • ${book.title} (${book.year || '?'}, ${book.pages || '?'} pages, ⭐ ${book.goodreads_rating || '?'})`
      );
    });
  }
}

main().catch(console.error);
