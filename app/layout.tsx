import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { BriefNotificationProvider } from "@/lib/brief/BriefNotificationContext";
import NavigationWrapper from "@/components/NavigationWrapper";
import BriefNotificationToast from "@/components/BriefNotificationToast";

export const metadata: Metadata = {
  title: "Grimlog | AI Battle Tracker",
  description: "AI-powered tactical logger for tabletop wargames",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>
          <BriefNotificationProvider>
            <NavigationWrapper>
              {children}
            </NavigationWrapper>
            <BriefNotificationToast />
          </BriefNotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

