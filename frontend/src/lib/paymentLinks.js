const BILLING_INTERVAL_LABELS = {
  day: "día",
  week: "semana",
  month: "mes",
  year: "año",
};

export function localizeBillingInterval(interval) {
  if (!interval) return "";
  return BILLING_INTERVAL_LABELS[String(interval).toLowerCase()] || interval;
}

export function withSpanishCheckoutLocale(url) {
  if (!url) return "";

  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.hostname.includes("stripe.com")) {
      parsedUrl.searchParams.set("locale", "es");
    }

    return parsedUrl.toString();
  } catch {
    return url;
  }
}
