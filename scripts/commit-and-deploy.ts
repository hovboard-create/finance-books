import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { execSync } from 'child_process';

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

interface Editorial {
  takeaway: string;
  key_lessons: string;
  who_its_for: string;
  buy_warning?: string;
}

function exec(command: string): string {
  try {
    return execSync(command, { encoding: 'utf-8' });
  } catch (error) {
    console.error(`Command failed: ${command}`);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting commit and deploy...\n');

  const booksJsonPath = path.join(process.cwd(), 'data', 'books.json');
  const editorialJsonPath = path.join(process.cwd(), 'data', 'editorial.json');
  const enrichedPath = path.join(process.cwd(), 'data', 'enriched-books.json');
  const generatedEditorialPath = path.join(process.cwd(), 'data', 'generated-editorial.json');

  // Check if enriched books and editorial exist
  if (!existsSync(enrichedPath) || !existsSync(generatedEditorialPath)) {
    console.log('⚠️  No new books to commit. Skipping deployment.');
    return;
  }

  const enrichedBooks: EnrichedBook[] = JSON.parse(readFileSync(enrichedPath, 'utf-8'));
  const generatedEditorial: Record<string, Editorial> = JSON.parse(
    readFileSync(generatedEditorialPath, 'utf-8')
  );

  if (enrichedBooks.length === 0) {
    console.log('ℹ️  No books to add. Skipping deployment.');
    return;
  }

  console.log(`📚 Adding ${enrichedBooks.length} new books...\n`);

  // 1. Update books.json
  console.log('1️⃣  Updating books.json...');
  const booksJson = JSON.parse(readFileSync(booksJsonPath, 'utf-8'));
  const originalCount = booksJson.length;

  // Filter out any books already in the database
  const newBooks = enrichedBooks.filter(
    (newBook) => !booksJson.some((existing: any) => existing.slug === newBook.slug)
  );

  if (newBooks.length > 0) {
    booksJson.push(...newBooks);
    writeFileSync(booksJsonPath, JSON.stringify(booksJson, null, 2));
    console.log(`   ✓ Added ${newBooks.length} books (${originalCount} → ${booksJson.length})`);
  } else {
    console.log(`   ℹ️  All books already in database`);
  }

  // 2. Update editorial.json
  console.log('2️⃣  Updating editorial.json...');
  const editorialJson = JSON.parse(readFileSync(editorialJsonPath, 'utf-8'));
  const originalEditorialCount = Object.keys(editorialJson).length;

  // Add only editorial for new books
  let editorialAdded = 0;
  newBooks.forEach((book) => {
    if (generatedEditorial[book.slug] && !editorialJson[book.slug]) {
      editorialJson[book.slug] = generatedEditorial[book.slug];
      editorialAdded++;
    }
  });

  if (editorialAdded > 0) {
    writeFileSync(editorialJsonPath, JSON.stringify(editorialJson, null, 2));
    console.log(
      `   ✓ Added ${editorialAdded} editorial entries (${originalEditorialCount} → ${Object.keys(editorialJson).length})`
    );
  }

  // 3. Run ETL
  console.log('3️⃣  Running ETL...');
  try {
    const output = exec('npm run etl');
    const match = output.match(/with_takeaway: (\d+)/);
    if (match) {
      console.log(`   ✓ ETL complete (${match[1]} books with editorial)`);
    } else {
      console.log(`   ✓ ETL complete`);
    }
  } catch (error) {
    console.error('   ✗ ETL failed');
    throw error;
  }

  // 4. Git commit
  if (newBooks.length > 0) {
    console.log('4️⃣  Committing to Git...');
    try {
      // Configure git user for CI/CD
      if (process.env.GIT_USER_NAME) {
        exec(`git config user.name "${process.env.GIT_USER_NAME}"`);
      }
      if (process.env.GIT_USER_EMAIL) {
        exec(`git config user.email "${process.env.GIT_USER_EMAIL}"`);
      }

      // Stage changes
      exec('git add data/books.json data/editorial.json');

      // Check if there are changes to commit
      const status = exec('git status --porcelain');
      if (status.length > 0) {
        const commitMessage = `feat: add ${newBooks.length} new finance books with editorial content

Added books:
${newBooks.map((b) => `- ${b.title} by ${b.author} (${b.year || 'N/A'})`).join('\n')}

Auto-generated via finance-books content pipeline.`;

        exec(`git commit -m "${commitMessage}"`);
        console.log(`   ✓ Committed ${newBooks.length} books`);
      }
    } catch (error) {
      console.warn('   ⚠️  Git commit failed (may already be committed)');
    }

    // 5. Git push
    console.log('5️⃣  Pushing to remote...');
    try {
      exec('git push origin main');
      console.log(`   ✓ Pushed to main`);
    } catch (error) {
      console.warn('   ⚠️  Git push failed (may not have origin or permission)');
    }
  }

  // 6. Summary
  console.log('\n✅ Deployment complete!\n');
  console.log('📊 Summary:');
  console.log(`   Books added: ${newBooks.length}`);
  console.log(`   Editorial generated: ${editorialAdded}`);
  console.log(`   Database updated: ✓`);
  console.log(`   Git committed: ${newBooks.length > 0 ? '✓' : '✗ (no changes)'}`);

  // Cleanup temp files
  console.log('\n🧹 Cleaning up temporary files...');
  try {
    if (existsSync(enrichedPath)) {
      execSync(`rm ${enrichedPath}`);
      console.log(`   ✓ Removed enriched-books.json`);
    }
    if (existsSync(generatedEditorialPath)) {
      execSync(`rm ${generatedEditorialPath}`);
      console.log(`   ✓ Removed generated-editorial.json`);
    }
  } catch (error) {
    console.warn('   ⚠️  Could not clean temp files');
  }
}

main().catch((error) => {
  console.error('\n❌ Deployment failed:', error.message);
  process.exit(1);
});
