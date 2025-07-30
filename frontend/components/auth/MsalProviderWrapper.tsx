"use client";
import { useEffect, useState } from "react";
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import msalConfig from "@/msalConfig";

export default function MsalProviderWrapper({ children }: { children: React.ReactNode }) {
  const [msalInstance, setMsalInstance] = useState<PublicClientApplication | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const instance = new PublicClientApplication(msalConfig);
      setMsalInstance(instance);
    }
  }, []);

  if (!msalInstance) return null; // or a loading spinner

  return <MsalProvider instance={msalInstance}>{children}</MsalProvider>;
}
