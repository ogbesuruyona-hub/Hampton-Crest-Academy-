import React, { useEffect, useRef, useState } from "react";
import * as tus from "tus-js-client";
import { FileText, Loader2, RefreshCw, Upload, X } from "lucide-react";
import { api, formatApiErrorDetail } from "../lib/api";

const MAX_BOOK_BYTES = 50 * 1024 * 1024;

const formatSize = (bytes) => {
  if (!bytes) return "";
  const megabytes = bytes / (1024 * 1024);
  return megabytes >= 1 ? `${megabytes.toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
};

export const BookPdfUploader = ({ value, onChange, testid = "book-pdf-uploader" }) => {
  const inputRef = useRef(null);
  const uploadRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  useEffect(
    () => () => {
      uploadRef.current?.abort();
    },
    [],
  );

  const chooseFile = () => inputRef.current?.click();

  const uploadFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError("");
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Solo se aceptan archivos PDF.");
      return;
    }
    if (file.size > MAX_BOOK_BYTES) {
      setError("El libro supera el límite de 50 MB.");
      return;
    }

    setUploading(true);
    setProgress(0);
    try {
      const { data: signed } = await api.post("/books/uploads/sign", {
        filename: file.name,
        size: file.size,
        content_type: "application/pdf",
      });

      await new Promise((resolve, reject) => {
        const upload = new tus.Upload(file, {
          endpoint: signed.resumable_url,
          retryDelays: [0, 3000, 5000, 10000, 20000],
          headers: { "x-signature": signed.token },
          uploadDataDuringCreation: true,
          removeFingerprintOnSuccess: true,
          chunkSize: 6 * 1024 * 1024,
          metadata: {
            bucketName: signed.bucket,
            objectName: signed.path,
            contentType: "application/pdf",
            cacheControl: "3600",
          },
          onError: reject,
          onProgress: (uploaded, total) => {
            setProgress(total ? Math.round((uploaded / total) * 100) : 0);
          },
          onSuccess: resolve,
        });
        uploadRef.current = upload;
        upload.start();
      });

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
          "No se pudo subir el libro.",
      );
    } finally {
      uploadRef.current = null;
      setUploading(false);
    }
  };

  const remove = async () => {
    await uploadRef.current?.abort(true);
    uploadRef.current = null;
    setProgress(0);
    setError("");
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
        <div className="flex items-center justify-between gap-3 border border-[var(--hc-border)] bg-[var(--hc-bg)] px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <FileText className="h-5 w-5 shrink-0 text-[var(--hc-gold)]" strokeWidth={1.5} />
            <div className="min-w-0">
              <div className="truncate text-sm text-[var(--hc-text)]" data-testid="book-pdf-filename">
                {value.filename || "Libro en PDF"}
              </div>
              <div className="text-[0.7rem] text-[var(--hc-text-muted)]">{formatSize(value.size)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={chooseFile}
              aria-label="Cambiar PDF"
              className="flex h-8 w-8 items-center justify-center border border-[var(--hc-border)] text-[var(--hc-text-muted)] hover:text-[var(--hc-gold)]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={remove}
              aria-label="Quitar PDF"
              className="flex h-8 w-8 items-center justify-center border border-[var(--hc-border)] text-[var(--hc-text-muted)] hover:text-[#A74444]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={chooseFile}
          disabled={uploading}
          data-testid="book-pdf-upload-button"
          className="w-full border border-dashed border-[var(--hc-border)] px-4 py-6 text-[var(--hc-text-secondary)] transition-colors hover:border-[var(--hc-gold)] hover:text-[var(--hc-text)] disabled:opacity-60"
        >
          <span className="flex items-center justify-center gap-2">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <span className="text-xs uppercase tracking-[0.18em]">
              {uploading ? `Subiendo libro · ${progress}%` : "Elegir libro en PDF"}
            </span>
          </span>
          {uploading ? (
            <span className="mx-auto mt-3 block h-1 max-w-sm overflow-hidden bg-[var(--hc-border)]">
              <span
                className="block h-full bg-[var(--hc-gold)] transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </span>
          ) : null}
        </button>
      )}

      <p className="mt-2 text-[0.65rem] text-[var(--hc-text-muted)]">
        PDF · máximo 50 MB · la carga continúa automáticamente si la conexión se interrumpe.
      </p>
      {error ? <div className="mt-2 text-xs text-[#A74444]">{error}</div> : null}
    </div>
  );
};
