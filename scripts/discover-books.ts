import axios from 'axios';
import * as cheerio from 'cheerio';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

interface DiscoveredBook {
  title: string;
  author: string;
  isbn13?: string;
  asin?: string;
  source: string;
  confidence: number;
}

const booksJsonPath = path.join(process.cwd(), 'data', 'books.json');

async function fetchNYTBestsellers(): Promise<DiscoveredBook[]> {
  try {
    const apiKey = process.env.NYT_API_KEY || 'demokey';
    const lists = ['combined-print-and-e-book-nonfiction', 'business-books'];
    const books: DiscoveredBook[] = [];

    for (const list of lists) {
      const response = await axios.get(
        `https://api.nytimes.com/svc/books/v3/lists/current/${list}.json?api-key=${apiKey}`,
        { timeout: 5000 }
      );

      const results = response.data.results.books || [];
      results.slice(0, 10).forEach((book: any) => {
        books.push({
          title: book.title,
          author: book.author,
          isbn13: book.primary_isbn13,
          source: 'nyt-bestsellers',
          confidence: 0.9,
        });
      });
    }

    console.log(`✓ NYT Bestsellers: ${books.length} books found`);
    return books;
  } catch (error) {
    console.error('✗ NYT Bestsellers failed:', (error as Error).message);
    return [];
  }
}

async function scrapeAmazonBestsellers(): Promise<DiscoveredBook[]> {
  try {
    const categories = [
      'business-money', // Business
      'self-help', // Self-improvement
    ];
    const books: DiscoveredBook[] = [];

    for (const category of categories) {
      try {
        const url = `https://www.amazon.com/Best-Sellers-Books-${category.replace('-', '-')}/zgbs/books/${getAmazonCategoryId(category)}`;
        const response = await axios.get(url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          timeout: 5000,
        });

        const $ = cheerio.load(response.data);
        const items = $('div[data-component-type="s-search-result"]').slice(0, 15);

        items.each((_, el) => {
          const $item = $(el);
          const title = $item.find('span[data-component-type="s-title"] a span').text().trim();
          const author = $item.find('a.a-size-base.a-color-secondary').first().text().trim();

          if (title && author) {
            books.push({
              title,
              author,
              source: 'amazon-bestsellers',
              confidence: 0.75,
            });
          }
        });
      } catch (err) {
        console.warn(`⚠ Amazon category ${category} failed`);
      }
    }

    console.log(`✓ Amazon Bestsellers: ${books.length} books found`);
    return books;
  } catch (error) {
    console.error('✗ Amazon scraping failed:', (error as Error).message);
    return [];
  }
}

async function scrapeReddit(): Promise<DiscoveredBook[]> {
  try {
    const subreddits = ['personalfinance', 'investing', 'financialcareers'];
    const books: DiscoveredBook[] = [];

    for (const subreddit of subreddits) {
      try {
        const response = await axios.get(`https://www.reddit.com/r/${subreddit}/top.json?t=week&limit=25`, {
          headers: {
            'User-Agent': 'FinanceBooksBot/1.0',
          },
          timeout: 5000,
        });

        const posts = response.data.data.children || [];
        const bookRegex = /["']([^"']+)["']\s+by\s+([^,\n]+)/gi;

        posts.slice(0, 10).forEach((post: any) => {
          const text = post.data.title + ' ' + (post.data.selftext || '');
          let match;

          while ((match = bookRegex.exec(text)) !== null) {
            books.push({
              title: match[1],
              author: match[2].trim(),
              source: `reddit-${subreddit}`,
              confidence: 0.65,
            });
          }
        });
      } catch (err) {
        console.warn(`⚠ Reddit subreddit r/${subreddit} failed`);
      }
    }

    console.log(`✓ Reddit: ${books.length} books found`);
    return books;
  } catch (error) {
    console.error('✗ Reddit scraping failed:', (error as Error).message);
    return [];
  }
}

function getAmazonCategoryId(category: string): string {
  const categoryMap: Record<string, string> = {
    'business-money': '173514',
    'self-help': '28656',
  };
  return categoryMap[category] || '173514';
}

function deduplicateByTitle(books: DiscoveredBook[]): DiscoveredBook[] {
  const seen = new Set<string>();
  return books.filter((book) => {
    const key = `${book.title.toLowerCase()}|${book.author.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function filterNewBooks(discovered: DiscoveredBook[], existing: any[]): DiscoveredBook[] {
  const existingTitles = new Set(existing.map((b) => b.title.toLowerCase()));
  return discovered.filter((book) => !existingTitles.has(book.title.toLowerCase()));
}

async function main() {
  console.log('🔍 Starting book discovery...\n');

  const existingBooks = JSON.parse(readFileSync(booksJsonPath, 'utf-8'));

  // Run all discovery sources in parallel
  const [nytBooks, amazonBooks, redditBooks] = await Promise.all([
    fetchNYTBestsellers(),
    scrapeAmazonBestsellers(),
    scrapeReddit(),
  ]);

  // Deduplicate and filter
  const allBooks = [...nytBooks, ...amazonBooks, ...redditBooks];
  const deduplicated = deduplicateByTitle(allBooks);
  const newBooks = filterNewBooks(deduplicated, existingBooks);

  // Write results
  const outputPath = path.join(process.cwd(), 'data', 'discovered-books.json');
  writeFileSync(outputPath, JSON.stringify(newBooks, null, 2));

  console.log(`\n📊 Summary:`);
  console.log(`   Total sources checked: 8`);
  console.log(`   Books found: ${allBooks.length}`);
  console.log(`   After dedup: ${deduplicated.length}`);
  console.log(`   New books: ${newBooks.length}`);
  console.log(`\n✅ Results saved to: ${outputPath}`);

  if (newBooks.length > 0) {
    console.log(`\n📚 New books to enrich:`);
    newBooks.forEach((book) => {
      console.log(`   • ${book.title} by ${book.author} (source: ${book.source})`);
    });
  }
}

main().catch(console.error);
