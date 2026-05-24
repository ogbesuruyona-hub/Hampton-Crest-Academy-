import React, { useRef, useState } from "react";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import { api, tokenStore } from "../lib/api";

export const PdfUploader = ({ value, onChange, testid }) => {
  // value: { url, filename, size } | null
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const onPick = () => inputRef.current?.click();

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset
    if (!file) return;
    setError("");
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are accepted.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError("File exceeds 25 MB limit.");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post("/uploads/report-pdf", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onChange?.({
        url: data.url,
        filename: data.filename,
        size: data.size,
      });
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const remove = () => onChange?.(null);

  const kb = value?.size ? Math.round(value.size / 1024) : 0;
  const sizeLabel = kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;

  return (
    <div data-testid={testid || "pdf-uploader"}>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={onFile}
        data-testid="pdf-file-input"
      />
      {value?.url ? (
        <div className="flex items-center justify-between gap-3 bg-[var(--hc-bg)] border border-[var(--hc-border)] px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <FileText className="h-5 w-5 text-[var(--hc-gold)] shrink-0" strokeWidth={1.5} />
            <div className="min-w-0">
              <div
                data-testid="pdf-filename"
                className="text-sm tracking-tight text-[var(--hc-text)] truncate"
              >
                {value.filename}
              </div>
              <div className="text-[0.7rem] tracking-tight text-[var(--hc-text-muted)]">
                {sizeLabel}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={remove}
            aria-label="Remove PDF"
            data-testid="pdf-remove"
            className="h-8 w-8 flex items-center justify-center border border-[var(--hc-border)] text-[var(--hc-text-muted)] hover:text-[#E07A7A] transition-colors"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onPick}
          disabled={uploading}
          data-testid="pdf-upload-button"
          className="w-full flex items-center justify-center gap-2 px-4 py-4 border border-dashed border-[var(--hc-border)] text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] hover:border-[var(--hc-gold)] transition-colors disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
          ) : (
            <Upload className="h-4 w-4" strokeWidth={1.5} />
          )}
          <span className="text-xs tracking-[0.18em] uppercase">
            {uploading ? "Uploading…" : "Attach PDF (max 25 MB)"}
          </span>
        </button>
      )}
      {error && (
        <div data-testid="pdf-error" className="mt-2 text-xs text-[#E07A7A]">
          {error}
        </div>
      )}
    </div>
  );
};

// Helper to open an authenticated PDF in a new tab
export const openPdf = (url) => {
  const token = tokenStore.get();
  if (!token) return;
  const full = url.startsWith("http") ? url : `${process.env.REACT_APP_BACKEND_URL}${url}`;
  const sep = full.includes("?") ? "&" : "?";
  window.open(`${full}${sep}auth=${encodeURIComponent(token)}`, "_blank", "noopener");
};
