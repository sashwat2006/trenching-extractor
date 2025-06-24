import { Configuration } from "@azure/msal-browser";

export const msalConfig: Configuration = {
  auth: {
    clientId: "8a1b3f20-6cc1-4bd3-b53b-81ac2cf0fdd5",
    authority: "https://login.microsoftonline.com/28ca66c4-1213-4649-b4e6-599b5f207a74",
    redirectUri: "http://localhost:3000/", // Change to your prod URL in production
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  },
};

export const loginRequest = {
  scopes: ["openid", "profile", "User.Read", "Mail.ReadWrite"], // Microsoft Graph basic profile + mail
};
