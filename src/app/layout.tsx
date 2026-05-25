import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.finance-books.com"),
  title: {
    default: "Finance-Books.com — The Best Finance Books, Curated by Life Stage",
    template: "%s | Finance-Books.com",
  },
  description:
    "Curated reading lists of the best finance books — for new grads, debt payoff, beginner investors, and entrepreneurs. Honest takeaways, key lessons, and direct Amazon links.",
  openGraph: {
    siteName: "Finance-Books.com",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://covers.openlibrary.org" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://m.media-amazon.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-full flex flex-col bg-cream-50 text-ink-900">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
