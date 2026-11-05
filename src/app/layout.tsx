import type { Metadata } from "next";
import localFont from "next/font/local";
import { SessionBoundary } from "@/components/auth/session-boundary";
import { NavigationProvider } from "@/components/pixel";
import { CookieNotice } from "@/components/legal/cookie-notice";
import { NavTracker } from "@/components/layout/nav-tracker";
import "./globals.css";

const pressStart = localFont({
  src: "../../public/assets/PressStart2P.ttf",
  variable: "--font-press-start",
  display: "swap",
  fallback: ["ui-monospace", "monospace"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: "Fili-QuizMo",
  description: "Fili-QuizMo is an interactive quiz platform for learners and educators.",
  openGraph: {
    title: "Fili-QuizMo",
    description:
      "An interactive Filipino quiz platform for learners and educators.",
    images: [
      {
        url: "/assets/Fili-QuizMo%20Logo.png",
        width: 2000,
        height: 2000,
        alt: "Fili-QuizMo trophy logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Fili-QuizMo",
    description:
      "An interactive Filipino quiz platform for learners and educators.",
    images: ["/assets/Fili-QuizMo%20Logo.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${pressStart.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NavTracker />
          <NavigationProvider>
            <SessionBoundary />
            {children}
            <CookieNotice />
          </NavigationProvider>
      </body>
    </html>
  );
}
