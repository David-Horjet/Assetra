import type { Metadata } from "next";
import { DM_Sans, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter-var",
  subsets: ["latin"],
  display: "swap",
});

// Used for figures: DM Sans has tabular numerals that hold their width
// while values animate.
const dmSans = DM_Sans({
  variable: "--font-dm-sans-var",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Assetra — Turn your stocks into working capital",
  description:
    "Borrow against tokenized stocks on Solana without selling them. Earn, borrow and lend with xStocks.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${dmSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-abyss text-chalk">
        {children}
      </body>
    </html>
  );
}
