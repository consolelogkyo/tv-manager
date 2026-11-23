import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], display: "swap" });

// Renderização dinâmica obrigatória: o nonce da CSP é gerado por requisição no
// middleware e o Next.js só consegue aplicá-lo em páginas renderizadas sob demanda.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "TV Manager — Gestão de Assinaturas",
    template: "%s · TV Manager",
  },
  description: "Painel interno para gestão de clientes, vencimentos e renovações de assinaturas de TV.",
  // Sistema interno: não deve ser indexado por buscadores.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#131b2e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: extensões do navegador (ex.: LanguageTool, Grammarly)
    // injetam atributos no <html> antes do React hidratar. Vale só para este elemento.
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrains.variable} min-h-dvh font-sans`}>
        <div className="app-backdrop" aria-hidden="true" />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
