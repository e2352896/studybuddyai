import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { app } from "./firebase";

export function initAppCheck() {
  const siteKey = import.meta.env.VITE_RECAPTCHA_V3_SITE_KEY;

  if (!siteKey) {
    console.warn(" VITE_RECAPTCHA_V3_SITE_KEY manquant. App Check non initialisé.");
    return;
  }

  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
}
