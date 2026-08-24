import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, ImagePlus, Loader2, RefreshCw, X } from "lucide-react";
import { api, formatApiErrorDetail } from "../lib/api";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const RETRY_DELAYS = [0, 1500, 3500];

export const ImageUploader = ({ value, onChange, testid, aspect = "landscape" }) => {
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

  const pickImage = () => inputRef.current?.click();

  const uploadToSignedUrl = (url, file) =>
    new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      uploadRef.current = request;
      request.open("PUT", url, true);
      request.setRequestHeader("Content-Type", file.type);
      request.upload.onprogress = (event) => {
        if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
      };
      request.onload = () => {
        if (request.status >= 200 && request.status < 300) {
          resolve();
          return;
        }
        reject(new Error(`La portada fue rechazada (${request.status}).`));
      };
      request.onerror = () => reject(new Error("Se interrumpió la conexión durante la carga."));
      request.onabort = () => {
        const abortError = new Error("Carga cancelada.");
        abortError.cancelled = true;
        reject(abortError);
      };
      request.send(file);
    });

  const uploadImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Usa una imagen JPG, PNG o WebP.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("La imagen supera el límite de 5 MB.");
      return;
    }

    setUploading(true);
    setProgress(0);
    try {
      const { data: signed } = await api.post("/uploads/image/sign", {
        filename: file.name,
        size: file.size,
        content_type: file.type,
      });
      if (!signed.upload_url || !signed.public_url) {
        throw new Error("No se recibió el enlace seguro para la portada.");
      }

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

      onChange?.(signed.public_url);
      setProgress(100);
    } catch (uploadError) {
      setError(
        formatApiErrorDetail(uploadError.response?.data?.detail) ||
          uploadError.message ||
          "No se pudo subir la imagen.",
      );
    } finally {
      uploadRef.current = null;
      setUploading(false);
    }
  };

  return (
    <div data-testid={testid || "image-uploader"}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={uploadImage}
        data-testid="image-file-input"
      />

      {value ? (
        <div className="flex items-start gap-4 rounded-sm border border-[#7d9b7f]/50 bg-[#edf3ea] p-3">
          <div
            className={`shrink-0 overflow-hidden border border-[var(--hc-border)] bg-[var(--hc-surface)] ${
              aspect === "portrait" ? "h-36 w-24" : "h-24 w-40"
            }`}
          >
            <img src={value} alt="Vista previa de la portada" className="h-full w-full object-cover" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-center gap-2 text-[#426246]">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-[0.65rem] uppercase tracking-[0.14em]">Portada lista</span>
            </div>
            <p className="text-xs leading-relaxed text-[var(--hc-text-secondary)]">
              La imagen se guardó correctamente.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={pickImage}
                disabled={uploading}
                className="inline-flex items-center gap-2 border border-[var(--hc-border)] px-3 py-2 text-[0.65rem] uppercase tracking-[0.16em] text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] disabled:opacity-60"
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Cambiar
              </button>
              <button
                type="button"
                onClick={() => onChange?.("")}
                aria-label="Quitar portada"
                className="inline-flex items-center gap-2 border border-[var(--hc-border)] px-3 py-2 text-[0.65rem] uppercase tracking-[0.16em] text-[var(--hc-text-muted)] hover:text-[#A74444]"
              >
                <X className="h-3.5 w-3.5" /> Quitar
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={pickImage}
          disabled={uploading}
          data-testid="image-upload-button"
          className="w-full rounded-sm border-2 border-dashed border-[var(--hc-gold)]/35 bg-white/55 px-4 py-6 text-[var(--hc-text-secondary)] hover:border-[var(--hc-gold)] hover:bg-white disabled:opacity-60"
        >
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[var(--hc-gold-soft)] text-[var(--hc-gold)]">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          </span>
          <span className="mt-2 block text-sm font-medium text-[var(--hc-text)]">
            {uploading ? `Subiendo portada… ${progress}%` : "Seleccionar portada"}
          </span>
          <span className="mt-1 block text-xs text-[var(--hc-text-muted)]">
            {uploading ? "No cierres esta ventana" : "Toca aquí para elegir una imagen"}
          </span>
          {uploading ? (
            <span className="mx-auto mt-3 block h-1.5 max-w-sm overflow-hidden rounded-full bg-[var(--hc-border)]">
              <span className="block h-full rounded-full bg-[var(--hc-gold)]" style={{ width: `${progress}%` }} />
            </span>
          ) : null}
        </button>
      )}
      <p className="mt-2 text-center text-[0.65rem] text-[var(--hc-text-muted)]">JPG, PNG o WebP · máximo 5 MB</p>
      {error ? (
        <div className="mt-3 rounded-sm border border-[#b75d5d]/35 bg-[#f8e9e7] px-3 py-2.5 text-xs text-[#913f3f]">
          {error}
        </div>
      ) : null}
    </div>
  );
};
