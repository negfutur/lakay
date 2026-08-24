import { AlertTriangle, ImagePlus, Loader2 } from "lucide-react";
import { useState } from "react";

export type MobileBrandingAsset = { key: string; url: string; filename: string; width: number; height: number };

type MobileBrandingUploaderProps = {
  kind: "icon" | "splash";
  asset: MobileBrandingAsset | null;
  disabled?: boolean;
  onUpload: (asset: { kind: "icon" | "splash"; filename: string; dataUrl: string }) => Promise<void>;
};

export default function MobileBrandingUploader({ kind, asset, disabled = false, onUpload }: MobileBrandingUploaderProps) {
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const label = kind === "icon" ? "Icône de l’application" : "Écran de démarrage";
  const guidance = kind === "icon" ? "PNG carré · 512–2048 px · 4 Mo max" : "PNG · 720–4096 px · 4 Mo max";

  const selectFile = async (file: File | undefined) => {
    if (!file || disabled || uploading) return;
    if (file.type !== "image/png" || file.size > 4 * 1024 * 1024) {
      setError("Choisissez un fichier PNG de 4 Mo maximum.");
      return;
    }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Invalid file"));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => reject(new Error("Invalid image"));
        image.src = dataUrl;
      });
      const valid = kind === "icon" ? dimensions.width === dimensions.height && dimensions.width >= 512 && dimensions.width <= 2048 : dimensions.width >= 720 && dimensions.height >= 720 && dimensions.width <= 4096 && dimensions.height <= 4096;
      if (!valid) {
        setError(kind === "icon" ? "L’icône doit être carrée, entre 512 et 2048 px." : "L’écran doit mesurer entre 720 et 4096 px dans chaque dimension.");
        return;
      }
      setUploading(true);
      setError(null);
      await onUpload({ kind, filename: file.name, dataUrl });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "L’upload a échoué.");
    } finally {
      setUploading(false);
    }
  };

  return <div className="rounded-lg border border-neutral-800 bg-[#101014] p-3"><div className="flex items-start gap-3"><div className={`grid shrink-0 place-items-center overflow-hidden rounded-lg border border-neutral-800 bg-black/20 ${kind === "icon" ? "size-11" : "h-11 w-16"}`}>{asset ? <img src={asset.url} alt={label} className="size-full object-cover" /> : <ImagePlus className="size-4 text-zinc-600" />}</div><div className="min-w-0 flex-1"><p className="text-[11px] font-medium text-zinc-200">{label}</p><p className="mt-0.5 text-[10px] text-zinc-500">{asset ? `${asset.filename} · ${asset.width} × ${asset.height} px` : guidance}</p><label className="mt-2 inline-flex h-7 cursor-pointer items-center rounded-md border border-neutral-800 px-2 text-[10px] text-zinc-300 hover:bg-white/[0.05] hover:text-white"><ImagePlus className="mr-1 size-3" />{uploading ? "Upload…" : asset ? "Remplacer" : "Ajouter"}<input type="file" accept="image/png" className="sr-only" disabled={disabled || uploading} onChange={event => void selectFile(event.target.files?.[0])} /></label>{error && <p role="alert" className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-200"><AlertTriangle className="size-3" />{error}</p>}{uploading && <Loader2 className="ml-2 inline size-3 animate-spin text-emerald-300" />}</div></div></div>;
}
