import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, FileText, Loader2, RefreshCw, Upload, X } from "lucide-react";
import { api, formatApiErrorDetail } from "../lib/api";

const MAX_BOOK_BYTES = 50 * 1024 * 1024;
const LARGE_PDF_WARNING_BYTES = 10 * 1024 * 1024;
const RETRY_DELAYS = [0, 2000, 5000];

const formatSize = (bytes) => {
  if (!bytes) return "";
  const megabytes = bytes / (1024 * 1024);
  return megabytes >= 1 ? `${megabytes.toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
};

export const BookPdfUploader = ({
  value,
  onChange,
  onUploadingChange,
  testid = "book-pdf-uploader",
  endpoint = "/books/uploads/sign",
  uploadingLabel = "Subiendo el libro",
  itemLabel = "libro",
  maxBytes = MAX_BOOK_BYTES,
  maxLabel = "50 MB",
}) => {
  const inputRef = useRef(null);
  const uploadRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [largeFileSize, setLargeFileSize] = useState(value?.size > LARGE_PDF_WARNING_BYTES ? value.size : 0);

  useEffect(
    () => () => {
      uploadRef.current?.abort();
    },
    [],
  );

  const chooseFile = () => inputRef.current?.click();

  const uploadToSignedUrl = (url, file) =>
    new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      uploadRef.current = request;
      request.open("PUT", url, true);
      request.setRequestHeader("Content-Type", "application/pdf");
      request.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
      request.onload = () => {
        if (request.status >= 200 && request.status < 300) {
          resolve();
          return;
        }
        let detail = "";
        try {
          detail = JSON.parse(request.responseText || "{}").message || "";
        } catch {
          detail = "";
        }
        reject(new Error(detail || `La carga fue rechazada (${request.status}).`));
      };
      request.onerror = () => reject(new Error("Se interrumpió la conexión durante la carga."));
      request.onabort = () => {
        const error = new Error("Carga cancelada.");
        error.cancelled = true;
        reject(error);
      };
      request.send(file);
    });

  const uploadFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError("");
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Solo se aceptan archivos PDF.");
      return;
    }
    if (file.size > maxBytes) {
      setError(`El ${itemLabel} supera el límite de ${maxLabel}.`);
      return;
    }
    setLargeFileSize(file.size > LARGE_PDF_WARNING_BYTES ? file.size : 0);

    setUploading(true);
    onUploadingChange?.(true);
    setProgress(0);
    try {
      const { data: signed } = await api.post(endpoint, {
        filename: file.name,
        size: file.size,
        content_type: "application/pdf",
      });

      if (!signed.upload_url) throw new Error("No se recibió el enlace seguro de carga.");

      let lastError;
      for (let attempt = 0; attempt < RETRY_DELAYS.length; attempt += 1) {
        if (RETRY_DELAYS[attempt]) {
          await new Promise((resolve) => window.setTimeout(resolve, RETRY_DELAYS[attempt]));
        }
        try {
          await uploadToSignedUrl(signed.upload_url, file);
          lastError = null;
          break;
        } catch (attemptError) {
          if (attemptError.cancelled) throw attemptError;
          lastError = attemptError;
        }
      }
      if (lastError) throw lastError;

      onChange?.({
        path: signed.path,
        filename: file.name,
        size: file.size,
      });
      setProgress(100);
    } catch (uploadError) {
      setError(
        formatApiErrorDetail(uploadError.response?.data?.detail) ||
          uploadError.message ||
          `No se pudo subir el ${itemLabel}.`,
      );
    } finally {
      uploadRef.current = null;
      setUploading(false);
      onUploadingChange?.(false);
    }
  };

  const remove = async () => {
    uploadRef.current?.abort();
    uploadRef.current = null;
    setProgress(0);
    setError("");
    setLargeFileSize(0);
    onChange?.(null);
  };

  return (
    <div data-testid={testid}>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={uploadFile}
        data-testid="book-pdf-file-input"
      />

      {value?.path ? (
        <div className="rounded-sm border border-[#7d9b7f]/50 bg-[#edf3ea] px-4 py-4">
          <div className="mb-3 flex items-center gap-2 text-[#426246]">
            <CheckCircle2 className="h-4 w-4" strokeWidth={1.8} />
            <span className="text-[0.68rem] font-medium uppercase tracking-[0.16em]">PDF cargado correctamente</span>
          </div>
          <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[var(--hc-gold)] shadow-sm">
              <FileText className="h-5 w-5" strokeWidth={1.5} />
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-[var(--hc-text)]" data-testid="book-pdf-filename">
                {value.filename || `${itemLabel.charAt(0).toUpperCase()}${itemLabel.slice(1)} en PDF`}
              </div>
              <div className="mt-0.5 text-[0.72rem] text-[var(--hc-text-muted)]">{formatSize(value.size)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={chooseFile}
              aria-label="Cambiar PDF"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--hc-border)] bg-white text-[var(--hc-text-muted)] hover:text-[var(--hc-gold)]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={remove}
              aria-label="Quitar PDF"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--hc-border)] bg-white text-[var(--hc-text-muted)] hover:text-[#A74444]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={chooseFile}
          disabled={uploading}
          data-testid="book-pdf-upload-button"
          className="w-full rounded-sm border-2 border-dashed border-[var(--hc-gold)]/40 bg-white/55 px-5 py-8 text-[var(--hc-text-secondary)] transition-colors hover:border-[var(--hc-gold)] hover:bg-white hover:text-[var(--hc-text)] disabled:cursor-wait disabled:opacity-70"
        >
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--hc-gold-soft)] text-[var(--hc-gold)]">
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
          </span>
          <span className="mt-3 block">
            <span className="block text-sm font-medium tracking-tight text-[var(--hc-text)]">
              {uploading ? `${uploadingLabel}… ${progress}%` : "Seleccionar PDF"}
            </span>
            <span className="mt-1 block text-xs text-[var(--hc-text-muted)]">
              {uploading ? "No cierres esta ventana" : "Toca aquí para elegirlo desde tu dispositivo"}
            </span>
          </span>
          {uploading ? (
            <span className="mx-auto mt-4 block h-1.5 max-w-sm overflow-hidden rounded-full bg-[var(--hc-border)]">
              <span
                className="block h-full rounded-full bg-[var(--hc-gold)] transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </span>
          ) : null}
        </button>
      )}

      <p className="mt-2 text-center text-[0.68rem] text-[var(--hc-text-muted)]">
        Solo PDF · máximo {maxLabel} · hasta 3 intentos automáticos
      </p>
      {largeFileSize ? (
        <div className="mt-3 rounded-sm border border-[#b98b3f]/45 bg-[#fff5dc] px-3 py-2.5 text-xs leading-relaxed text-[#76531b]" data-testid="large-pdf-warning">
          Este PDF pesa {formatSize(largeFileSize)}. Los archivos mayores de 10 MB pueden tardar más en abrirse en conexiones móviles.
        </div>
      ) : null}
      {error ? (
        <div className="mt-3 rounded-sm border border-[#b75d5d]/35 bg-[#f8e9e7] px-3 py-2.5 text-xs leading-relaxed text-[#913f3f]">
          <strong className="font-medium">No pudimos subir el PDF.</strong> {error}
        </div>
      ) : null}
    </div>
  );
};
