import React, { useState } from "react";
import { AlertTriangle, CreditCard, ExternalLink } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api, formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";

const formatDate = (value) => {
  if (!value) return "muy pronto";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "muy pronto";
  return new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
};

export default function BillingNotice() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  if (!user || user.membership_status !== "past_due" || user.complimentary || user.role === "admin") {
    return null;
  }

  const openPortal = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/billing/portal");
      window.location.assign(data.url);
    } catch (error) {
      toast.error(formatApiErrorDetail(error.response?.data?.detail) || error.message);
      setLoading(false);
    }
  };

  return (
    <section
      role="alert"
      data-testid="billing-grace-notice"
      className="border-b border-[#a86f20]/35 bg-[#fff4dc] px-4 sm:px-8 py-3 text-[#4b3515]"
    >
      <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0 text-[#a86f20]" strokeWidth={1.8} />
          <div>
            <div className="text-sm font-semibold">No pudimos renovar tu membresía.</div>
            <p className="text-xs leading-relaxed mt-0.5">
              Conservas acceso hasta el {formatDate(user.grace_period_end)}. Actualiza tu método de
              pago para evitar una interrupción.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openPortal}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 bg-[#071925] text-white px-4 py-2.5 text-[0.68rem] tracking-[0.15em] uppercase font-semibold disabled:opacity-50 shrink-0"
        >
          <CreditCard className="h-3.5 w-3.5" />
          {loading ? "Abriendo…" : "Actualizar pago"}
          <ExternalLink className="h-3 w-3" />
        </button>
      </div>
    </section>
  );
}
