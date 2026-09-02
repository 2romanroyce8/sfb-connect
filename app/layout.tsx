import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
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

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sfbconnect.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "SFB Connect — Be The Business AI Finds.",
    template: "%s | SFB Connect",
  },
  description:
    "SFB Connect analyzes and optimizes how your business is represented across the digital signals AI systems use when answering local and commercial recommendations. $200/year. No monthly subscription.",
  openGraph: {
    title: "SFB Connect — Be The Business AI Finds.",
    description:
      "Your customers are asking AI who to choose. Make sure it can find you. $200/year AI Presence Optimization.",
    url: siteUrl,
    siteName: "SFB Connect",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SFB Connect — Be The Business AI Finds.",
    description:
      "AI Presence Optimization for local and service businesses. $200/year.",
  },
  alternates: { canonical: "/" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
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
