import type { Metadata } from "next";
import { Cinzel, Cormorant_Garamond } from "next/font/google";
import "./globals.css";

const display = Cinzel({ variable: "--font-display", subsets: ["latin"], weight: ["600", "700"] });
const serif = Cormorant_Garamond({ variable: "--font-serif", subsets: ["latin"], weight: ["400", "600"], style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: "Sir Nitpicksalot",
  description: "The code reviewer that has never once said LGTM.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
