/**
 * Refreshes rating + price data for every book from Amazon's Product
 * Advertising API (PA-API 5.0), writing results to data/amazon-data.json.
 *
 * Why a separate file: lets us refresh daily without touching books.json
 * (which is hand-curated metadata) or editorial.json (which is hand-written).
 *
 * Setup:
 *   1. Sign up for PA-API at https://affiliate-program.amazon.com/assoc_credentials/home
 *   2. Add credentials to .env.local:
 *        AMAZON_ACCESS_KEY=AKIA...
 *        AMAZON_SECRET_KEY=...
 *        AMAZON_PARTNER_TAG=hovboard-20
 *        AMAZON_HOST=webservices.amazon.com
 *        AMAZON_REGION=us-east-1
 *   3. Run: npm run refresh-amazon
 *
 * Important: Amazon's Operating Agreement requires displayed prices/ratings
 * to be no more than 24 hours old. Schedule this script via cron daily.
 *
 * Rate limits: New Associates start at 1 TPS. We batch in 10s and throttle.
 *
 * 180-day rule: PA-API access revokes after 180 days without 3 qualifying
 * sales. This script logs a warning if the API returns the access-revoked
 * error so we can fail loudly rather than silently.
 */
import amazonPaapi from "amazon-paapi";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

type Book = {
  slug: string;
  title: string;
  asin: string | null;
};

type AmazonRow = {
  asin: string;
  rating: number | null;
  rating_count: number | null;
  price: number | null;
  price_display: string | null;
  currency: string | null;
  availability: string | null;
  updated_at: string;
};

// Load .env.local manually (no dependency on dotenv to keep the install lean).
function loadEnv() {
  const envPath = resolve(__dirname, "..", ".env.local");
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  loadEnv();
  const root = resolve(__dirname, "..");

  const required = [
    "AMAZON_ACCESS_KEY",
    "AMAZON_SECRET_KEY",
    "AMAZON_PARTNER_TAG",
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Missing env vars: ${missing.join(", ")}`);
    console.error(`Add them to .env.local. See .env.example for the format.`);
    process.exit(1);
  }

  const commonParameters = {
    AccessKey: process.env.AMAZON_ACCESS_KEY!,
    SecretKey: process.env.AMAZON_SECRET_KEY!,
    PartnerTag: process.env.AMAZON_PARTNER_TAG!,
    PartnerType: "Associates",
    Marketplace: "www.amazon.com",
    Host: process.env.AMAZON_HOST || "webservices.amazon.com",
    Region: process.env.AMAZON_REGION || "us-east-1",
  };

  const books = JSON.parse(
    readFileSync(resolve(root, "data/books.json"), "utf8")
  ) as Book[];

  const asinToSlug = new Map<string, string>();
  for (const b of books) {
    if (b.asin) asinToSlug.set(b.asin, b.slug);
  }
  const asins = [...asinToSlug.keys()];

  console.log(`Refreshing Amazon data for ${asins.length} books…\n`);

  const out: Record<string, AmazonRow> = {};
  const errors: Array<{ asin: string; error: string }> = [];

  // PA-API GetItems accepts up to 10 ASINs per request.
  for (const batch of chunk(asins, 10)) {
    const requestParameters = {
      ItemIds: batch,
      ItemIdType: "ASIN",
      Condition: "New",
      Resources: [
        "ItemInfo.Title",
        "Offers.Listings.Price",
        "Offers.Listings.Availability.Message",
        "CustomerReviews.StarRating",
        "CustomerReviews.Count",
      ],
    };

    try {
      const response = await amazonPaapi.GetItems(commonParameters, requestParameters);
      const items = response?.ItemsResult?.Items ?? [];
      for (const item of items) {
        const asin = item.ASIN;
        const slug = asinToSlug.get(asin);
        if (!slug) continue;

        const listing = item.Offers?.Listings?.[0];
        const price = listing?.Price?.Amount ?? null;
        const priceDisplay = listing?.Price?.DisplayAmount ?? null;
        const currency = listing?.Price?.Currency ?? null;
        const availability = listing?.Availability?.Message ?? null;

        const stars = item.CustomerReviews?.StarRating?.Value ?? null;
        const reviewCount = item.CustomerReviews?.Count ?? null;

        out[slug] = {
          asin,
          rating: typeof stars === "number" ? stars : null,
          rating_count: typeof reviewCount === "number" ? reviewCount : null,
          price: typeof price === "number" ? price : null,
          price_display: priceDisplay,
          currency,
          availability,
          updated_at: new Date().toISOString(),
        };

        console.log(
          `✓ ${asin}  ${item.ItemInfo?.Title?.DisplayValue?.padEnd(45) ?? ""}  ${stars ? `★${stars}` : "no rating"}  ${priceDisplay ?? "no price"}`
        );
      }

      // Log any ASINs PA-API couldn't resolve in this batch
      const returnedAsins = new Set(items.map((i: { ASIN: string }) => i.ASIN));
      for (const asin of batch) {
        if (!returnedAsins.has(asin)) {
          console.log(`⚠️  ${asin}  (PA-API returned no data — book may be out of print or wrong ASIN)`);
          errors.push({ asin, error: "no_data" });
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Detect the dreaded "access revoked after 180 days without sales" error
      if (message.includes("not authorized") || message.includes("AccessDenied")) {
        console.error(`\n❌ PA-API access denied. This often means your 180-day window expired without 3 qualifying sales.`);
        console.error(`   Check status at https://affiliate-program.amazon.com/assoc_credentials/home`);
      } else {
        console.error(`❌ Batch error: ${message}`);
      }
      for (const asin of batch) errors.push({ asin, error: message });
    }

    // Throttle: 1 TPS is the new-Associate limit; we wait 1.2s between batches.
    await new Promise((r) => setTimeout(r, 1200));
  }

  const outPath = resolve(root, "data/amazon-data.json");
  writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");

  console.log(`\n--- Summary ---`);
  console.log(`✓  ${Object.keys(out).length} books refreshed`);
  console.log(`❌ ${errors.length} errors`);
  console.log(`\nWrote ${outPath}`);
  console.log(`Re-run ETL: npm run etl`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
