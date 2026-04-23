import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

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
  openGraph: {
    title: "ResikIn — Sistem Pelaporan Sampah Kelurahan",
    description: "Laporkan. Pantau. Bersihkan. Platform pelaporan sampah untuk kelurahan Kota Yogyakarta.",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
