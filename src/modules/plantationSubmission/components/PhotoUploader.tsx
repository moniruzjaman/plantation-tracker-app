import { useRef, useState } from 'react';
import { Camera, Images, X, Loader2 } from 'lucide-react';
import { compressPhoto, hashBlob } from '../../../utils/photoEvidence';
import type { PhotoRecord } from '../../../types/plantation';

interface PhotoUploaderProps {
  photos: PhotoRecord[];
  onChange: (photos: PhotoRecord[]) => void;
  siteLatitude: number;
  siteLongitude: number;
  maxPhotos?: number;
  language?: 'bn' | 'en';
}

/**
 * Camera-first photo capture with gallery fallback, per spec — max 3
 * photos per plant entry. Every photo is compressed client-side and
 * SHA-256 hashed before being stored (reusing utils/photoEvidence.ts,
 * the same pipeline the existing checkpoint/revisit flow uses), and
 * geotagged with the site's current coordinates at capture time.
 */
export default function PhotoUploader({
  photos,
  onChange,
  siteLatitude,
  siteLongitude,
  maxPhotos = 3,
  language = 'bn',
}: PhotoUploaderProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = {
    camera: language === 'bn' ? 'ক্যামেরা' : 'Camera',
    gallery: language === 'bn' ? 'গ্যালারি' : 'Gallery',
    max: language === 'bn' ? `সর্বোচ্চ ${maxPhotos}টি ছবি` : `Max ${maxPhotos} photos`,
    limitReached: language === 'bn' ? `সর্বোচ্চ ${maxPhotos}টি ছবি আপলোড করা যাবে` : `Maximum ${maxPhotos} photos allowed`,
    processing: language === 'bn' ? 'প্রক্রিয়াকরণ হচ্ছে...' : 'Processing...',
  };

  const remaining = maxPhotos - photos.length;

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).slice(0, remaining);
    if (files.length === 0) {
      setError(t.limitReached);
      return;
    }
    setError(null);
    setProcessing(true);
    try {
      const newPhotos: PhotoRecord[] = [];
      for (const file of files) {
        const compressed = await compressPhoto(file);
        const sha256 = await hashBlob(compressed.blob);
        newPhotos.push({
          id: crypto.randomUUID(),
          stage: 'planting',
          url: compressed.url,
          sha256,
          capturedAt: new Date().toISOString(),
          latitude: siteLatitude,
          longitude: siteLongitude,
          photoType: 'general',
        });
      }
      onChange([...photos, ...newPhotos]);
    } catch (err: any) {
      setError(err?.message || 'Photo processing failed');
    } finally {
      setProcessing(false);
    }
  };

  const removePhoto = (id: string) => {
    onChange(photos.filter((p) => p.id !== id));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-semibold text-gray-500">{t.max}</label>
        <span className="text-[10px] text-gray-400">{photos.length}/{maxPhotos}</span>
      </div>

      {/* Thumbnails */}
      {photos.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {photos.map((p) => (
            <div key={p.id} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
              <img src={p.url} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(p.id)}
                className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Capture buttons */}
      {remaining > 0 && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={processing}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-semibold hover:bg-emerald-100 disabled:opacity-60 cursor-pointer"
          >
            {processing ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
            {t.camera}
          </button>
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            disabled={processing}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-gray-50 text-gray-600 text-[11px] font-semibold hover:bg-gray-100 disabled:opacity-60 cursor-pointer"
          >
            {processing ? <Loader2 size={13} className="animate-spin" /> : <Images size={13} />}
            {t.gallery}
          </button>
        </div>
      )}

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {error && <p className="text-[10px] text-red-600">{error}</p>}
    </div>
  );
}
