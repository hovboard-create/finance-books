import type { MetadataRoute } from "next";
import { getAllBooks, getAllSegments } from "@/lib/db";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://finance-books.com";
  const now = new Date();

  const staticUrls = [
    { url: `${base}/`, lastModified: now, priority: 1.0 },
    { url: `${base}/books`, lastModified: now, priority: 0.6 },
    { url: `${base}/about`, lastModified: now, priority: 0.4 },
  ];

  const segmentUrls = getAllSegments().map((s) => ({
    url: `${base}/${s.slug}`,
    lastModified: now,
    priority: 0.9,
  }));

  const bookUrls = getAllBooks().map((b) => ({
    url: `${base}/books/${b.slug}`,
    lastModified: now,
    priority: 0.7,
  }));

  return [...staticUrls, ...segmentUrls, ...bookUrls];
}
