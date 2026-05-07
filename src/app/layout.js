import { cookies } from "next/headers";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { THEME_COOKIE_NAME, isTheme } from "@/lib/theme.mjs";

export const metadata = {
  title: "ResikIn — Sistem Pelaporan Sampah Kelurahan",
  description:
    "Laporkan masalah sampah di lingkungan Anda. Pantau status penanganan secara realtime. Bersama menjaga kebersihan kelurahan Kota Yogyakarta.",
  keywords: ["sampah", "laporan", "kelurahan", "yogyakarta", "kebersihan", "lingkungan"],
  authors: [{ name: "Tim MyMusicFavoriteGueh — OmahTI UGM" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ResikIn",
  },
  openGraph: {
    title: "ResikIn — Sistem Pelaporan Sampah Kelurahan",
    description: "Laporkan. Pantau. Bersihkan. Platform pelaporan sampah untuk kelurahan Kota Yogyakarta.",
    type: "website",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#059669",
};

const themeScript = `
(() => {
  try {
    const storageKey = 'resikin-theme';
    const cookieTheme = document.cookie
      .split('; ')
      .find((row) => row.startsWith(storageKey + '='))
      ?.split('=')[1];
    const storedTheme = window.localStorage.getItem(storageKey);
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const theme = storedTheme === 'light' || storedTheme === 'dark'
      ? storedTheme
      : cookieTheme === 'light' || cookieTheme === 'dark'
        ? cookieTheme
        : systemTheme;
    window.localStorage.setItem(storageKey, theme);
    document.cookie = storageKey + '=' + theme + '; Path=/; Max-Age=31536000; SameSite=Lax';
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    document.documentElement.dataset.theme = theme;
  } catch (_) {
    document.documentElement.classList.add('light');
    document.documentElement.dataset.theme = 'light';
  }
})();
`;

export default async function RootLayout({ children }) {
  const themeCookie = (await cookies()).get(THEME_COOKIE_NAME)?.value;
  const initialTheme = isTheme(themeCookie) ? themeCookie : "light";

  return (
    <html
      lang="id"
      className={`h-full antialiased ${initialTheme}`}
      data-theme={initialTheme}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <Navbar />
          <main className="flex-1 pb-16 md:pb-0">{children}</main>
          <Footer />
          <MobileBottomNav />
        </ThemeProvider>
      </body>
    </html>
  );
}
