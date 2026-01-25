import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { DossierNotificationProvider } from "@/lib/dossier/DossierNotificationContext";
import NavigationWrapper from "@/components/NavigationWrapper";
import DossierNotificationToast from "@/components/DossierNotificationToast";

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
          <DossierNotificationProvider>
            <NavigationWrapper>
              {children}
            </NavigationWrapper>
            <DossierNotificationToast />
          </DossierNotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

