import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://lucys-birds.vercel.app";

export const metadata: Metadata = {
  // Makes the share card and icons resolve to absolute URLs, which is what
  // messaging apps need — a relative path previews as nothing.
  metadataBase: new URL(SITE),
  title: "Lucy's Birds",
  description:
    "A collection of birds Lucy has found, with their songs. Tap a bird to hear it.",
  openGraph: {
    title: "Lucy's Birds",
    description:
      "A collection of birds Lucy has found, with their songs. Tap a bird to hear it.",
    type: "website",
    siteName: "Lucy's Birds",
  },
  twitter: { card: "summary_large_image" },
  // Suppresses the Pinterest browser extension's hover-to-save button on every
  // image. The artwork isn't ours to hand to Pinterest, and the overlay sits
  // right on top of the birds.
  other: { pinterest: "nopin" },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Lucy's Birds",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fcfcfb",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
