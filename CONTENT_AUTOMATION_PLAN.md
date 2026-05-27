# Finance Books: Automated Content Pipeline

## System Overview

Three-stage automated pipeline:
1. **Discovery** — Find new finance books from multiple sources weekly
2. **Enrichment** — Fetch metadata (ISBN, cover, ratings) and enrich books.json
3. **Editorial Generation** — Use Claude API to write takeaway/key_lessons/who_its_for
4. **Deployment** — Auto-commit, run ETL, deploy to Vercel

## Stage 1: Book Discovery (Weekly)

**Sources to monitor:**
- Amazon "Personal Finance" bestsellers (updated daily)
- Amazon "Business" bestsellers
- NYT Bestseller List (via API)
- Goodreads "Personal Finance" lists
- r/personalfinance and r/investing subreddits (top posts, mentions)
- Finance newsletters (Morning Brew, The Economist book section)

**Script: `scripts/discover-books.ts`**
```typescript
// Pseudo-code structure
async function discoverBooks() {
  const amazonBooks = await scrapeAmazonBestsellers();
  const nytBooks = await fetchNYTBestsellers(); // Has API
  const redditBooks = await scrapeReddit(['personalfinance', 'investing']);
  
  const allBooks = [...amazonBooks, ...nytBooks, ...redditBooks];
  const deduplicated = deduplicateByISBN(allBooks);
  const newBooks = filterNotInDatabase(deduplicated);
  
  return newBooks; // Returns list of {title, author, isbn, amazon_link}
}
```

**Data structure returned:**
```json
[
  {
    "title": "Atomic Habits",
    "author": "James Clear",
    "isbn13": "9780735211292",
    "amazon_asin": "0735211299",
    "source": "amazon-bestsellers",
    "confidence": 0.95
  }
]
```

---

## Stage 2: Metadata Enrichment (Weekly)

**Script: `scripts/enrich-books.ts`**

Sources:
- Open Library API → cover_url, pages, year
- Amazon API (or scrape) → current ASIN, price, availability
- Goodreads API → goodreads_rating, goodreads_id
- ISBN lookup → canonical ISBN13

```typescript
async function enrichBook(discovered) {
  const openLibrary = await fetchOpenLibrary(discovered.isbn13);
  const goodreads = await fetchGoodreads(discovered.title, discovered.author);
  const amazon = await fetchAmazonData(discovered.asin);
  
  return {
    slug: slugify(discovered.title),
    title: discovered.title,
    author: discovered.author,
    asin: amazon.asin,
    isbn13: discovered.isbn13,
    year: openLibrary.year,
    pages: openLibrary.pages,
    goodreads_rating: goodreads.rating,
    cover_url: openLibrary.cover_url,
    youtube_id: null // Could search YouTube for author interviews
  };
}
```

**Output:** Enriched book entries ready to append to books.json

---

## Stage 3: Editorial Generation (Weekly or On-Demand)

**Script: `scripts/generate-editorial.ts`**

Use Claude API to generate editorial content from:
- Book summary (from Goodreads or Open Library)
- Author bio
- Book description
- Reader reviews (top 3–5 reviews for common themes)

```typescript
async function generateEditorial(book) {
  const bookData = await fetchBookData(book.isbn13); // Get summary, reviews
  const prompt = `
You are a financial literacy expert writing book recommendations.

Book: ${book.title} by ${book.author}
Published: ${book.year}
Summary: ${bookData.summary}
Top Reader Feedback: ${bookData.topReviews}

Write editorial content in JSON format with exactly these fields:
- takeaway: 2-3 paragraph summary of the book's core thesis and why it matters (200-250 words)
- key_lessons: Exactly 5 bullet points of specific, actionable takeaways (each 15-20 words)
- who_its_for: 2-3 sentences describing ideal reader by life stage, profession, or problem (80-120 words)
- buy_warning: [optional] Any caveats, dated advice, or author bias (if none, omit this field)

Return ONLY valid JSON, no markdown.`;
  
  const response = await anthropic.messages.create({
    model: "claude-opus-4-1-20250805",
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }]
  });
  
  return JSON.parse(response.content[0].text);
}
```

**Output:** Add to editorial.json with slug as key

---

## Stage 4: Git Automation & Deployment

**Script: `scripts/commit-and-deploy.ts`**

```typescript
async function commitAndDeploy(newBooks, newEditorial) {
  // 1. Update books.json
  const booksJson = readJSON('data/books.json');
  booksJson.push(...newBooks);
  writeJSON('data/books.json', booksJson);
  
  // 2. Update editorial.json
  const editorialJson = readJSON('data/editorial.json');
  Object.assign(editorialJson, newEditorial);
  writeJSON('data/editorial.json', editorialJson);
  
  // 3. Run ETL
  await execSync('npm run etl');
  
  // 4. Git commit
  await execSync('git add data/*.json');
  await execSync(`git commit -m "feat: add ${newBooks.length} new books + editorial"`);
  await execSync('git push origin main');
  
  // 5. Trigger Vercel deploy (optional if auto-deploy on push)
  // Or call Vercel API to trigger deployment
}
```

---

## Execution Schedule (GitHub Actions)

**`.github/workflows/discover-books.yml`** — Weekly Monday 9 AM

```yaml
name: Discover New Books
on:
  schedule:
    - cron: '0 9 * * 1' # Every Monday at 9 AM UTC

jobs:
  discover:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm install
      
      - name: Discover new books
        run: npm run discover-books
        env:
          AMAZON_API_KEY: ${{ secrets.AMAZON_API_KEY }}
          GOODREADS_API_KEY: ${{ secrets.GOODREADS_API_KEY }}
      
      - name: Enrich metadata
        run: npm run enrich-books
      
      - name: Generate editorial (Claude API)
        run: npm run generate-editorial
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      
      - name: Commit and deploy
        run: npm run commit-and-deploy
        env:
          GIT_USER_NAME: "Finance Books Bot"
          GIT_USER_EMAIL: "bot@finance-books.com"
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Notify on Slack
        if: always()
        run: npm run notify-slack
        env:
          SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK }}
```

---

## Implementation Checklist

### Phase 1: Discovery & Enrichment (2–3 days)
- [ ] `scripts/discover-books.ts` — Scrape Amazon, NYT, Reddit
- [ ] `scripts/enrich-books.ts` — Fetch Open Library, Goodreads, Amazon
- [ ] Test locally: `npm run discover-books`
- [ ] Add secrets to GitHub (API keys)

### Phase 2: Editorial Generation (1–2 days)
- [ ] `scripts/generate-editorial.ts` — Claude API integration
- [ ] Test with 3–5 sample books
- [ ] Validate JSON output format
- [ ] Add ANTHROPIC_API_KEY to GitHub secrets

### Phase 3: Git Automation (1 day)
- [ ] `scripts/commit-and-deploy.ts` — Git + ETL + deploy
- [ ] Test locally (dry-run)
- [ ] Add GitHub Actions workflow (`.github/workflows/discover-books.yml`)
- [ ] Test workflow runs end-to-end

### Phase 4: Monitoring & Refinement (Ongoing)
- [ ] Slack notifications on discovery/failure
- [ ] Weekly review of discovered books (human QA gate)
- [ ] Refine editorial prompts based on quality
- [ ] Track discovery sources (which source finds best books?)

---

## Cost & Requirements

**APIs:**
- **Open Library** — Free
- **Goodreads** — Free (has API)
- **NYT Bestsellers** — Free (has API)
- **Amazon Product Advertising API** — ~$0.01–0.05 per request (or web scraping, free)
- **Claude API** — ~$0.01–0.03 per book editorial (via Anthropic API)

**Example monthly cost:**
- 12 books discovered × $0.03/editorial = $0.36
- API calls + scraping = ~$5
- **Total: ~$6/month**

**GitHub Actions:** Free tier (2000 min/month) covers this easily

---

## Quality Gates

### Automatic (Script-Level)
- ✅ Book already in database? Skip
- ✅ Goodreads rating < 3.5? Flag for human review
- ✅ Publication year < 2005? Flag for human review (unless classic finance book)
- ✅ Generated editorial missing fields? Regenerate

### Manual (Weekly Human Review)
- Before commit: Review discovered books + generated editorial
- Reject/edit as needed, re-commit
- 15 minutes/week

---

## Segment Assignment (Automatic)

Add logic to assign discovered book to segment based on:
- Title keywords + author background + Goodreads category
- If unclear, default to "Business Books" (safest)

```typescript
function assignSegment(book) {
  const keywords = book.title.toLowerCase();
  
  if (keywords.includes('beginner') || keywords.includes('start')) 
    return 'New Grads';
  if (keywords.includes('debt') || keywords.includes('payoff'))
    return 'Debt Payoff';
  if (keywords.includes('invest') || keywords.includes('stock'))
    return 'Beginner Investors';
  if (keywords.includes('startup') || keywords.includes('founder'))
    return 'Entrepreneurs';
  if (keywords.includes('habit') || keywords.includes('productivity'))
    return 'Business Books';
  
  return 'Business Books'; // Default
}
```

---

## Manual Overrides

Allow manual edits via simple JSON file (`data/editorial-overrides.json`):

```json
{
  "atomic-habits": {
    "segment_override": "Entrepreneurs",
    "editorial_override": {
      "takeaway": "Custom override text here..."
    }
  }
}
```

ETL merges overrides last, so manual edits take priority.

---

## Success Metrics

Track in `.github/workflows/`:
- Books discovered per week (target: 2–3)
- Books with editorial generated successfully (target: 100%)
- ETL build time (target: <5 sec)
- Failed API calls (target: <5%)
- Deployment success rate (target: 100%)

Post metrics to Slack weekly.

---

## Failure Handling

| Failure | Action |
|---------|--------|
| API timeout | Retry 3x with exponential backoff |
| Editorial generation fails | Mark book as "pending editorial", skip commit |
| Git push fails | Email alert, human intervention |
| ETL fails | Rollback, send alert, block deploy |

---

## Optional: Human-in-the-Loop

**If you want editorial QA before publishing:**

1. Script generates editorial → creates a PR with changes
2. You review PR on GitHub (comment/edit)
3. Once approved, auto-commit-and-deploy
4. Slack notification when done

This adds friction but ensures quality. Trade-off: 15 min/week review vs. fully automated.

