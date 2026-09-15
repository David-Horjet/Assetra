import type { Metadata } from "next";
import { DM_Sans, Inter, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter-var",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Display face for headings and headline figures.
 *
 * The design calls for Aeonik, which is a commercial licence from CoType
 * Foundry — the free copies in circulation are unlicensed, so shipping one in
 * a public repo is not an option. Schibsted Grotesk is the closest open
 * equivalent: the same geometric grotesque construction with slightly
 * humanist detailing.
 *
 * To swap in licensed Aeonik: drop the woff2 files in public/fonts, declare
 * them with next/font/local, and point --font-display at the result. The CSS
 * already lists "Aeonik" ahead of this in the stack.
 */
const display = Schibsted_Grotesk({
  variable: "--font-display-var",
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
      className={`${inter.variable} ${dmSans.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-abyss text-chalk">
        {children}
      </body>
    </html>
  );
}
