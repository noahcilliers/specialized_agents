import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { Sidebar } from "@/components/sidebar";
import { listAgents } from "@/lib/db";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Modular · Personal agents",
  description: "A crew of small, specialized agents, each with one job.",
};

async function SidebarWithAgents() {
  const agents = await listAgents();
  return (
    <Sidebar
      agents={agents.map(({ id, name, emoji, color, status }) => ({ id, name, emoji, color, status }))}
    />
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <div className="flex min-h-dvh flex-col md:flex-row">
          <Suspense fallback={<aside className="hidden w-64 shrink-0 border-r border-zinc-200/80 bg-white/70 md:block" />}>
            <SidebarWithAgents />
          </Suspense>
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
