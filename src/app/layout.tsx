import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { ptBR } from "@clerk/localizations";
import { dark } from "@clerk/themes";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KORE - Inteligência Financeira",
  description: "Gestão financeira estratégica para PF e PJ.",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "KORE",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      localization={ptBR}
      appearance={{
        baseTheme: dark,
        variables: { colorPrimary: "#22c55e" },
      }}
    >
      <html lang="pt-BR">
        {/* REMOVI 'bg-black' DAQUI. Quem controla a cor agora é o globals (base) ou a página (temas) */}
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased overflow-x-hidden`}
        >
          <main className="flex min-h-screen flex-col items-center w-full max-w-[100vw] overflow-x-hidden">
            {children}
          </main>
        </body>
      </html>
    </ClerkProvider>
  );
}