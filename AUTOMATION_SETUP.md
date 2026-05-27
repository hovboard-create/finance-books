# Finance Books: Automated Content Pipeline Setup

## Overview

The finance-books.com content pipeline is fully automated. Once configured, it runs weekly to discover new finance books, enrich their metadata, generate editorial content, and deploy updates.

**Execution flow:**
1. **Discovery** (weekly) → Find new books from 8+ sources
2. **Enrichment** → Fetch metadata from Open Library, Goodreads, Amazon
3. **Editorial Generation** → Use Claude AI to write takeaway/lessons/audience
4. **Deployment** → Git commit, run ETL, push to main

---

## Prerequisites

### 1. Node.js
```bash
node --version  # Should be v20+
```

### 2. npm dependencies
```bash
cd /Users/jonathan/code/finance-books/web
npm install  # Installs axios, cheerio, anthropic SDK, etc.
```

### 3. Git configuration
```bash
git config user.name "Your Name"
git config user.email "your@email.com"
```

---

## API Keys & Secrets

You need to set these as GitHub repository secrets (or environment variables for local testing).

### Required for Discovery & Enrichment

| API | Key | Status | Where to get |
|-----|-----|--------|--------------|
| **NYT Books** | `NYT_API_KEY` | Optional but recommended | https://developer.nytimes.com/docs/books-api/1/overview |
| **Goodreads** | `GOODREADS_API_KEY` | Optional but recommended | https://www.goodreads.com/api (deprecated but still works) |
| **Anthropic** | `ANTHROPIC_API_KEY` | ✅ **REQUIRED** | https://console.anthropic.com/account/keys |

### Optional for Deployment

| Key | Status | Purpose |
|-----|--------|---------|
| `GITHUB_TOKEN` | Auto-provided | Git push in GitHub Actions |
| `SLACK_WEBHOOK` | Optional | Notifications |

---

## Setup Instructions

### Step 1: Get Anthropic API Key

**This is required.** Claude API generates all editorial content.

1. Go to https://console.anthropic.com/account/keys
2. Create a new API key
3. Copy it (you can only see it once)

### Step 2: Add Secrets to GitHub

1. Go to your GitHub repository
2. Settings → Secrets and variables → Actions
3. Create new repository secret:
   - Name: `ANTHROPIC_API_KEY`
   - Value: [paste your API key]

**Optional: Add other API keys**

For better discovery, add:
- `NYT_API_KEY` → https://developer.nytimes.com (free tier, get API key)
- `GOODREADS_API_KEY` → https://www.goodreads.com/api (get key, includes app secret)

### Step 3: Test Locally (Optional but Recommended)

```bash
cd /Users/jonathan/code/finance-books/web

# Set API key for local testing
export ANTHROPIC_API_KEY="sk-ant-..."

# Run the full pipeline
npm run content-pipeline
```

Or run individual steps:

```bash
# Discover books
npm run discover-books

# Enrich metadata
npm run enrich-books

# Generate editorial
npm run generate-editorial

# Review changes, then commit
npm run commit-and-deploy
```

### Step 4: Enable GitHub Actions Workflow

1. Go to Actions tab in GitHub
2. Find "Automated Content Pipeline" workflow
3. Click "Enable workflow" if disabled

The workflow runs automatically every Monday at 9 AM UTC.

To test manually:
1. Go to Actions → Automated Content Pipeline
2. Click "Run workflow" → "Run workflow"

---

## Understanding the Pipeline

### Discovery (`discover-books.ts`)

Scans these sources for new finance books:
- Amazon bestsellers (Business, Self-Help categories)
- NYT Bestseller List (Non-Fiction, Business)
- Reddit (r/personalfinance, r/investing, r/financialcareers)
- Goodreads (top books in "Personal Finance")

**Output:** `data/discovered-books.json`
```json
[
  {
    "title": "Atomic Habits",
    "author": "James Clear",
    "source": "amazon-bestsellers",
    "confidence": 0.75
  }
]
```

### Enrichment (`enrich-books.ts`)

For each discovered book, fetches:
- ISBN, pages, publication year (Open Library)
- Cover image URL (Open Library)
- Goodreads rating
- Amazon ASIN (attempted)

**Output:** `data/enriched-books.json`
```json
[
  {
    "slug": "atomic-habits",
    "title": "Atomic Habits",
    "author": "James Clear",
    "isbn13": "9780735211292",
    "year": 2018,
    "pages": 320,
    "goodreads_rating": 4.35,
    "cover_url": "https://covers.openlibrary.org/b/isbn/..."
  }
]
```

### Editorial Generation (`generate-editorial.ts`)

Uses Claude API to generate editorial content from:
- Book summary + description
- Goodreads reviews
- Author bio

**Prompt template:**
```
You are a financial literacy expert writing book recommendations.

Book: [Title] by [Author]
Published: [Year]
Summary: [Book summary]

Write editorial content in JSON with:
- takeaway: 2-3 paragraph summary (200-250 words)
- key_lessons: 5 bullet points
- who_its_for: 2-3 sentences on ideal reader
- buy_warning: [optional] caveats or limitations

Return ONLY valid JSON.
```

**Output:** `data/generated-editorial.json`
```json
{
  "atomic-habits": {
    "takeaway": "James Clear's 2018 bestseller...",
    "key_lessons": "• Small changes compound...\n• Habit loops are...",
    "who_its_for": "Anyone looking to build better daily habits...",
    "buy_warning": "[optional field]"
  }
}
```

### Commit & Deploy (`commit-and-deploy.ts`)

1. Merges new books into `data/books.json`
2. Merges editorial into `data/editorial.json`
3. Runs ETL to rebuild SQLite database
4. Commits changes to git with auto-generated message
5. Pushes to main branch
6. Cleans up temp files

---

## Running the Pipeline

### Automatic (GitHub Actions)

Runs every Monday at 9 AM UTC. No action needed.

To check status:
1. Go to Actions tab
2. Look at "Automated Content Pipeline" workflow runs
3. Green checkmark = success, red X = failed

### Manual Trigger

Via GitHub UI:
1. Go to Actions
2. Select "Automated Content Pipeline"
3. Click "Run workflow" → "Run workflow"

Via CLI:
```bash
gh workflow run content-pipeline.yml
```

### Manual Local Run

```bash
# Set env variables
export ANTHROPIC_API_KEY="sk-ant-..."
export GIT_USER_NAME="Your Name"
export GIT_USER_EMAIL="your@email.com"

# Run full pipeline
npm run content-pipeline

# Or step by step
npm run discover-books
npm run enrich-books
npm run generate-editorial
npm run commit-and-deploy
```

---

## Quality Control

### Automatic Filters

The scripts skip books that:
- Already exist in `data/books.json` (by title match)
- Have Goodreads rating < 3.5 (quality gate)
- Were published before 2005 (unless manually added)
- Failed to enrich with metadata

### Manual Review (Optional)

If you want to review discovered books before publishing:

1. **After enrichment**, check `data/enriched-books.json`
2. **Edit or delete** books you don't want
3. Run `npm run generate-editorial` to generate editorial for remaining books
4. Run `npm run commit-and-deploy` to publish

---

## Monitoring & Alerts

### Success Notifications

When the pipeline completes successfully, you'll see:
- ✅ Git commit with message like "feat: add 2 new finance books with editorial content"
- ✅ Slack notification (if webhook configured)
- ✅ New books live on finance-books.com within 1-2 minutes (Vercel auto-deploys on git push)

### Failure Handling

If pipeline fails:
1. Check GitHub Actions logs for error details
2. Common issues:
   - `ANTHROPIC_API_KEY` not set → Set secret in GitHub
   - API rate limit hit → Retry in 1 hour
   - Goodreads API timeout → Rerun manually
   - Git permission issue → Check GITHUB_TOKEN secret

**Slack notification on failure** includes a link to the failed workflow.

---

## Cost Estimate

**Monthly cost (12 books/month):**
- Claude API editorial generation: ~$0.36 (12 × $0.03 per book)
- Other API calls: ~$5-10 (Goodreads, Open Library, some Amazon)
- **Total: ~$6-10/month**

**GitHub Actions:** Free tier (2000 min/month)

---

## Customization

### Adjust Discovery Sources

Edit `scripts/discover-books.ts` to add or remove sources:
```typescript
async function main() {
  const [nytBooks, amazonBooks, redditBooks] = await Promise.all([
    fetchNYTBestsellers(),      // Remove this line to disable
    scrapeAmazonBestsellers(),
    scrapeReddit(),
  ]);
}
```

### Change Schedule

Edit `.github/workflows/content-pipeline.yml`:
```yaml
on:
  schedule:
    - cron: '0 9 * * 1'  # Monday 9 AM UTC
    # Change to: '0 9 * * 0' for Sunday
    # Or: '0 9 * * *' for daily
```

### Adjust Editorial Generation Prompt

Edit `scripts/generate-editorial.ts`, the `prompt` variable:
```typescript
const prompt = `You are a financial literacy expert...
[Customize this prompt as needed]
`;
```

### Add Pre-filtering

Before generating editorial, filter books by:
- Rating threshold
- Publication date range
- Category/keywords
- Author reputation

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **"No API key provided"** | Set `ANTHROPIC_API_KEY` secret in GitHub |
| **"Book already exists"** | Check `data/books.json` — duplicate detected |
| **"Failed to fetch metadata"** | API timeout — rerun manually, APIs are unreliable |
| **"Editorial generation failed"** | Claude API error — check logs, retry |
| **"Git push failed"** | Check `GITHUB_TOKEN` secret exists |
| **"No new books found"** | Normal — discovery runs weekly, might find 0-3 books |

---

## Next Steps

1. ✅ Add `ANTHROPIC_API_KEY` to GitHub secrets
2. ✅ (Optional) Add `NYT_API_KEY` and `GOODREADS_API_KEY` for better discovery
3. ✅ Test locally: `npm run discover-books` (or full pipeline)
4. ✅ Check GitHub Actions workflow is enabled
5. ✅ Monitor first automated run (Monday 9 AM UTC)

---

## Support

If something breaks:
1. Check GitHub Actions logs for specific errors
2. Test locally: `export ANTHROPIC_API_KEY="..."; npm run discover-books`
3. Review the CONTENT_AUTOMATION_PLAN.md for architecture details
4. Check if external APIs (Open Library, Goodreads) are down

The pipeline is resilient — if one source fails, others still run. Partial success is OK.
