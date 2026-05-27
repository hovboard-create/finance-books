import axios from 'axios';
import * as cheerio from 'cheerio';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

interface AmazonBook {
  title: string;
  author: string;
  asin: string;
  goodreads_rating?: number;
}

async function scrapeAmazonTop100(): Promise<AmazonBook[]> {
  console.log('🛍️  Scraping Amazon Best Sellers (Business & Finance)...\n');

  const books: AmazonBook[] = [];
  const urls = [
    'https://www.amazon.com/Best-Sellers-Business-Finance/zgbs/books/468220',
    'https://www.amazon.com/s?k=best+sellers+business+books&i=digital-text&s=sales-rank',
  ];

  for (const url of urls) {
    try {
      console.log(`Fetching: ${url}`);
      const response = await axios.get(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        timeout: 10000,
      });

      const $ = cheerio.load(response.data);

      // Method 1: Try data-component-type (modern Amazon)
      let items = $('div[data-component-type="s-search-result"]');

      // Method 2: Fallback to span.s-size-mini (older format)
      if (items.length === 0) {
        items = $('div[data-index]');
      }

      // Method 3: Try to find any a[href*="/dp/"] with nearby title/author
      if (items.length === 0) {
        console.log(`  ℹ️  Trying fallback selector...`);
        const seenASINs = new Set<string>();
        const links = $('a[href*="/dp/"]');
        links.each((idx, el) => {
          const href = $(el).attr('href') || '';
          const asinMatch = href.match(/\/dp\/([A-Z0-9]{10})/);
          if (asinMatch) {
            const asin = asinMatch[1];
            if (seenASINs.has(asin)) return; // Skip duplicates
            seenASINs.add(asin);

            // Look for title in nearby elements
            let title = $(el).find('span').first().text().trim() ||
                       $(el).closest('div').find('span[class*="size"]').first().text().trim();

            // Filter out prices and other junk
            if (title &&
                title.length > 5 &&
                !title.match(/^\$/) &&                    // Skip prices
                !title.match(/^[0-9]+\.[0-9]+ out of/) && // Skip ratings
                !title.match(/^[0-9]+ formats/) &&        // Skip format info
                !title.match(/^[0-9]+ pts$/) &&           // Skip points
                !title.match(/Hardcover|Paperback|Kindle|Format/i)) { // Skip format labels
              books.push({
                title: title.substring(0, 200),
                author: 'Unknown',
                asin,
              });
            }
          }
        });
      } else {
        let count = 0;
        items.each((idx, el) => {
          if (count >= 100) return; // Limit per page

          const $item = $(el);

          // Try to find title
          let title = $item.find('span.a-size-base-plus.a-color-base.a-text-normal').text().trim();
          if (!title) {
            title = $item.find('h2 a span').first().text().trim();
          }
          if (!title) {
            title = $item.find('span[class*="a-size"]').first().text().trim();
          }

          // Try to find author
          let author = $item.find('a.a-size-base.a-color-secondary').first().text().trim();
          if (!author) {
            author = $item.find('.a-row.a-color-secondary span').first().text().trim();
          }
          if (!author) {
            author = $item.find('a[href*="/s?k="]').first().text().trim();
          }

          // Try to find ASIN
          let asin = '';
          const linkElem = $item.find('a[href*="/dp/"]').first();
          const href = linkElem.attr('href') || '';
          const asinMatch = href.match(/\/dp\/([A-Z0-9]{10})/);
          if (asinMatch) {
            asin = asinMatch[1];
          }

          if (title && asin && title.length > 5) {
            books.push({
              title: title.substring(0, 200),
              author: author || 'Unknown',
              asin,
            });
            count++;
            console.log(`  [${count}] ${title} by ${author || 'Unknown'}`);
          }
        });
      }

      console.log(`  ✓ Found ${books.length} books\n`);
    } catch (error) {
      console.error(`  ✗ Failed: ${(error as Error).message}\n`);
    }
  }

  return books;
}

async function fetchGoodreadsRatings(title: string, author: string): Promise<number | undefined> {
  try {
    const response = await axios.get(
      `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}&limit=1`,
      { timeout: 3000 }
    );

    const firstResult = response.data.docs?.[0];
    if (firstResult?.isbn?.[0]) {
      // Try to get Goodreads data
      return undefined; // Goodreads API is deprecated, skip
    }
  } catch (error) {
    return undefined;
  }
}

async function main() {
  console.log('📚 BULK IMPORT: Amazon Top 100 Business/Finance Books\n');
  console.log('='.repeat(60) + '\n');

  const booksJsonPath = path.join(process.cwd(), 'data', 'books.json');
  const existingBooks = JSON.parse(readFileSync(booksJsonPath, 'utf-8'));
  const existingASINs = new Set(existingBooks.map((b: any) => b.asin));

  // Scrape Amazon
  const scraped = await scrapeAmazonTop100();
  console.log(`Found ${scraped.length} books on Amazon\n`);

  // Filter duplicates
  const newBooks = scraped.filter((b) => !existingASINs.has(b.asin));
  console.log(`${newBooks.length} are new (not already in database)\n`);

  // Enrich with minimal data (would need separate enrichment step for full metadata)
  const enrichedBooks = newBooks.map((book) => ({
    slug: slugify(book.title),
    title: book.title,
    author: book.author,
    asin: book.asin,
    isbn13: undefined, // Would be fetched in enrichment step
    year: new Date().getFullYear(), // Placeholder
    pages: 0, // Placeholder
    goodreads_rating: 4.0, // Placeholder
    cover_url: `https://images-na.ssl-images-amazon.com/images/P/${book.asin}.01.L.jpg`,
    youtube_id: null,
  }));

  // Save for enrichment
  const outputPath = path.join(process.cwd(), 'data', 'bulk-import-books.json');
  writeFileSync(outputPath, JSON.stringify(enrichedBooks, null, 2));

  console.log(`\n✅ Saved ${enrichedBooks.length} books to: ${outputPath}`);
  console.log('\nNext steps:');
  console.log('1. Review: data/bulk-import-books.json');
  console.log('2. Run enrichment: npm run enrich-books');
  console.log('3. Generate editorial: npm run generate-editorial');
  console.log('4. Deploy: npm run commit-and-deploy');
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

main().catch(console.error);
