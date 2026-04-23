import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import MobileBottomNav from "@/components/layout/MobileBottomNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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

export default function RootLayout({ children }) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className="min-h-full flex flex-col">
        <Navbar />
        <main className="flex-1 pb-16 md:pb-0">{children}</main>
        <Footer />
        <MobileBottomNav />
      </body>
    </html>
  );
}
