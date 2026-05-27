import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

interface EnrichedBook {
  slug: string;
  title: string;
  author: string;
  isbn13?: string;
  year?: number;
  pages?: number;
  goodreads_rating?: number;
}

interface Editorial {
  takeaway: string;
  key_lessons: string;
  who_its_for: string;
  buy_warning?: string;
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function generateEditorial(book: EnrichedBook): Promise<Editorial | null> {
  try {
    const prompt = `You are a financial literacy expert writing book recommendations for finance-books.com.

Book Title: "${book.title}"
Author: ${book.author}
Published: ${book.year || 'Unknown'}
Pages: ${book.pages || 'Unknown'}
Rating: ⭐ ${book.goodreads_rating || 'Unknown'}/5

Your task: Write editorial content for this finance book in JSON format with these EXACT fields:

{
  "takeaway": "[2-3 paragraph summary of the book's core thesis and why it matters for personal finance. 200-250 words. Be specific about what the book teaches.]",
  "key_lessons": "[Exactly 5 bullet points of specific, actionable takeaways. Each bullet should be 15-25 words. Format: • Point one\\n• Point two\\n...]",
  "who_its_for": "[2-3 sentences describing the ideal reader. Consider: life stage, profession, financial situation, problem they're trying to solve. 80-120 words.]",
  "buy_warning": "[OPTIONAL - only include if there are caveats. Any dated advice, controversial claims, author bias, or situations where the book might NOT be useful. 50-100 words. Omit this field if not applicable.]"
}

Guidelines:
- Be specific and concrete, not generic
- Use first-person perspective in takeaway (e.g., "The book shows you how to...")
- Key lessons should be memorable and actionable
- Avoid repeating the exact same points across sections
- If this is a personal finance classic, acknowledge its influence
- If the author has conflicts of interest (sells courses, promotes specific products), mention it in buy_warning
- Return ONLY valid JSON, no markdown, no extra text, no code fences

Generate the editorial now:`;

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-1-20250805',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error(`  ✗ No JSON found in response`);
      return null;
    }

    const editorial = JSON.parse(jsonMatch[0]) as Editorial;

    // Validate required fields
    if (!editorial.takeaway || !editorial.key_lessons || !editorial.who_its_for) {
      console.error(`  ✗ Missing required fields`);
      return null;
    }

    return editorial;
  } catch (error) {
    console.error(`  ✗ Generation failed:`, (error as Error).message);
    return null;
  }
}

async function main() {
  console.log('✍️  Starting editorial generation...\n');

  const enrichedPath = path.join(process.cwd(), 'data', 'enriched-books.json');
  const enrichedBooks: EnrichedBook[] = JSON.parse(readFileSync(enrichedPath, 'utf-8'));

  console.log(`📝 Generating editorial for ${enrichedBooks.length} books...\n`);

  const editorialMap: Record<string, Editorial> = {};
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < enrichedBooks.length; i++) {
    const book = enrichedBooks[i];
    console.log(`[${i + 1}/${enrichedBooks.length}] ${book.title}`);

    const editorial = await generateEditorial(book);
    if (editorial) {
      editorialMap[book.slug] = editorial;
      successCount++;
      console.log(`  ✓ Generated (${editorial.key_lessons.split('•').length - 1} lessons)`);
    } else {
      failureCount++;
      console.log(`  ✗ Failed`);
    }

    // Rate limiting: Claude API allows generous rate limits, but be respectful
    // Wait 1 second between requests
    if (i < enrichedBooks.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Write results
  const outputPath = path.join(process.cwd(), 'data', 'generated-editorial.json');
  writeFileSync(outputPath, JSON.stringify(editorialMap, null, 2));

  console.log(`\n📊 Summary:`);
  console.log(`   Total: ${enrichedBooks.length}`);
  console.log(`   ✓ Generated: ${successCount}`);
  console.log(`   ✗ Failed: ${failureCount}`);
  console.log(`\n✅ Results saved to: ${outputPath}`);

  if (successCount > 0) {
    console.log(`\n📚 Sample editorial generated:`);
    const firstKey = Object.keys(editorialMap)[0];
    const sample = editorialMap[firstKey];
    console.log(`\n   Title: ${enrichedBooks[0].title}`);
    console.log(`   Takeaway (first 100 chars): ${sample.takeaway.substring(0, 100)}...`);
    console.log(`   Lessons: ${sample.key_lessons.split('•').length - 1} points`);
  }
}

main().catch(console.error);
