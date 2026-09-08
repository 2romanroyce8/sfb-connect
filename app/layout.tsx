import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

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

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sfbconnect.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "SFB Connects — Be The Business AI Finds.",
    template: "%s | SFB Connects",
  },
  description:
    "SFB Connects analyzes and optimizes how your business is represented across the digital signals AI systems use when answering local and commercial recommendations. Plans start at $19.99/month.",
  openGraph: {
    title: "SFB Connects — Be The Business AI Finds.",
    description:
      "Your customers are asking AI who to choose. Make sure it can find you. Plans start at $19.99/month.",
    url: siteUrl,
    siteName: "SFB Connects",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SFB Connects — Be The Business AI Finds.",
    description:
      "AI Presence Optimization for local and service businesses. Plans start at $19.99/month.",
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
    >
      <body className="font-sans">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "SFB Connects",
              url: siteUrl,
              description:
                "AI Presence Optimization — SFB Connects analyzes and optimizes the digital signals AI systems use when evaluating and recommending businesses.",
            }),
          }}
        />
        {children}
      </body>
    </html>
  );
}
