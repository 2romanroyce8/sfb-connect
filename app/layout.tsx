import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono, Instrument_Serif } from "next/font/google";
import "./theme-tokens.css";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

// The canonical host is www -- the apex 308-redirects to it, so advertising
// the apex as canonical/og:url diluted the signal search engines see.
const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://www.sfbconnect.com").replace(/^https?:\/\/sfbconnect\.com/, "https://www.sfbconnect.com");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "SFB Connect — One Agent. Eight Jobs.",
    template: "%s | SFB Connect",
  },
  description:
    "One AI agent, eight jobs, a human overseer. SFB Connect gets your business found by AI search and automates growth work.",
  openGraph: {
    title: "SFB Connect — One Agent. Eight Jobs.",
    description:
      "An AI agent assigned to your business — outbound, ads, website, follow-up, chat, reviews, operations. A human expert checks everything it does.",
    url: siteUrl,
    siteName: "SFB Connect",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SFB Connect — Be The Business AI Finds.",
    description:
      "One AI agent, eight jobs, a human overseer.",
  },
  alternates: { canonical: "/" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${mono.variable} ${instrumentSerif.variable}`}
      data-theme="dark"
      suppressHydrationWarning
    >
      <head>
        {/* Theme before first paint (lib/theme.ts): localStorage → cookie → default. Static pages stay static. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "SFB Connect",
              url: siteUrl,
              description:
                "AI Presence Optimization — SFB Connect analyzes and optimizes the digital signals AI systems use when evaluating and recommending businesses.",
            }),
          }}
        />
        {children}
      </body>
    </html>
  );
}
