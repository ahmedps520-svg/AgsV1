import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, Inter, Playfair_Display } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import { SessionProvider } from "@/lib/api/session";
import { I18nProvider } from "@/lib/i18n/provider";
import { ServiceWorker } from "@/components/service-worker";
import { BRAND } from "@/lib/brand";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

/** Arabic UI face — also the fallback for Arabic glyphs inside English pages. */
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-arabic",
  display: "swap",
});

/** The crest wordmark. Self-hosted so the logo renders identically everywhere. */
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-playfair",
  display: "swap",
});

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ahmedps520-svg.github.io/AgsV1";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: BRAND.productName,
    template: `%s · ${BRAND.productName}`,
  },
  description:
    `Real-time dismissal for ${BRAND.name}. Parents tap when they arrive, staff call students from one live queue, and the dismissal board updates instantly.`,
  applicationName: BRAND.productName,
  manifest: `${basePath}/manifest.webmanifest`,
  appleWebApp: {
    capable: true,
    title: `${BRAND.shortName} Dismissal`,
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: `${basePath}/favicon.png`, sizes: "32x32", type: "image/png" },
      { url: `${basePath}/icons/icon-192.png`, sizes: "192x192", type: "image/png" },
      { url: `${basePath}/icons/icon-512.png`, sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: `${basePath}/icons/apple-touch-icon.png`, sizes: "180x180" }],
  },
  openGraph: {
    title: `${BRAND.productName}`,
    description: `The calm, real-time way to run dismissal at ${BRAND.shortName}.`,
    type: "website",
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#141b2e" },
  ],
};

/**
 * Content Security Policy.
 *
 * GitHub Pages cannot set response headers, so the policy is delivered as a
 * meta tag. It is deliberately tight: scripts and styles may only come from
 * this origin, and the only network destinations allowed are Supabase (REST,
 * Auth and the Realtime websocket).
 *
 * `frame-ancestors` is deliberately absent — browsers ignore it in a meta tag,
 * so framing is blocked by the script below instead. On a host that can set
 * headers, send `frame-ancestors 'none'` and drop that script.
 */
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  // Next.js inlines a small bootstrap script and its streamed payloads.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "manifest-src 'self'",
  "worker-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} ${plexArabic.variable}`}
      suppressHydrationWarning
    >
      <head>
        <meta httpEquiv="Content-Security-Policy" content={CSP} />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        <meta name="color-scheme" content="light dark" />
      </head>
      <body className="antialiased">
        {/*
          Clickjacking guard. A static host cannot send X-Frame-Options or a
          header CSP, so refuse to render inside someone else's frame.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: "if(window.top!==window.self){window.top.location=window.self.location}",
          }}
        />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Skip to content
        </a>
        <I18nProvider>
          <SessionProvider>
            <ToastProvider>{children}</ToastProvider>
          </SessionProvider>
        </I18nProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
