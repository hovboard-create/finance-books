import { bookAffiliateUrl } from "@/lib/affiliate";

type Props = {
  book: { asin: string | null; title: string; author: string };
  label?: string;
  size?: "sm" | "md" | "lg";
};

export function AmazonButton({ book, label = "Buy on Amazon", size = "md" }: Props) {
  const sizeClass =
    size === "sm" ? "text-sm px-4 py-2" : size === "lg" ? "text-base px-6 py-3" : "";
  return (
    <a
      href={bookAffiliateUrl(book)}
      target="_blank"
      rel="nofollow sponsored noopener"
      className={`amazon-btn ${sizeClass}`}
    >
      {label}
    </a>
  );
}
