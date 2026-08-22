import React, { useRef, useState } from "react";
import { ImagePlus, Loader2, RefreshCw, X } from "lucide-react";
import { api, formatApiErrorDetail } from "../lib/api";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const ImageUploader = ({ value, onChange, testid, aspect = "landscape" }) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const pickImage = () => inputRef.current?.click();

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
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post("/uploads/image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onChange?.(data.url);
    } catch (uploadError) {
      setError(
        formatApiErrorDetail(uploadError.response?.data?.detail) ||
          uploadError.message ||
          "No se pudo subir la imagen.",
      );
    } finally {
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
        <div className="flex items-start gap-4 border border-[var(--hc-border)] bg-[var(--hc-bg)] p-3">
          <div
            className={`shrink-0 overflow-hidden border border-[var(--hc-border)] bg-[var(--hc-surface)] ${
              aspect === "portrait" ? "h-36 w-24" : "h-24 w-40"
            }`}
          >
            <img src={value} alt="Vista previa de la portada" className="h-full w-full object-cover" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="text-xs leading-relaxed text-[var(--hc-text-secondary)]">
              Portada lista. Para que se vea nítida, usa una imagen vertical para libros y horizontal para cursos.
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
          className="flex w-full items-center justify-center gap-2 border border-dashed border-[var(--hc-border)] px-4 py-5 text-[var(--hc-text-secondary)] hover:border-[var(--hc-gold)] hover:text-[var(--hc-text)] disabled:opacity-60"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          <span className="text-xs uppercase tracking-[0.18em]">
            {uploading ? "Subiendo portada…" : "Elegir portada desde el dispositivo"}
          </span>
        </button>
      )}
      <p className="mt-2 text-[0.65rem] text-[var(--hc-text-muted)]">JPG, PNG o WebP · máximo 5 MB.</p>
      {error && <div className="mt-2 text-xs text-[#A74444]">{error}</div>}
    </div>
  );
};
