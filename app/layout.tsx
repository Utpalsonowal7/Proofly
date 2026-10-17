import type { Metadata } from "next";
import "@fontsource-variable/dm-sans";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Proofly — good work, on the same page.", template: "%s · Proofly" },
  description:
    "A considered space for creative projects, visual feedback, and confident approvals.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('proofly-theme')==='dark')document.documentElement.classList.add('dark')}catch{}",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
