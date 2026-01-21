'use client';

import { useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Upload, X, Loader2, ImageIcon } from 'lucide-react';

/**
 * ImageUpload Component
 *
 * A reusable image upload component with drag-drop, preview, and progress support.
 * Works with react-hook-form and supports single or multiple file uploads.
 *
 * @example
 * ```tsx
 * // Single image upload
 * <ImageUpload
 *   onUpload={async (file) => {
 *     await uploadImage(productId, file);
 *   }}
 *   maxSize={5 * 1024 * 1024}
 *   accept="image/*"
 * />
 *
 * // Multiple images with preview
 * <ImageUpload
 *   multiple
 *   value={images}
 *   onUpload={handleUpload}
 *   onRemove={handleRemove}
 *   disabled={uploading}
 * />
 *
 * // With react-hook-form
 * <FormField
 *   control={form.control}
 *   name="images"
 *   render={({ field }) => (
 *     <FormItem>
 *       <FormControl>
 *         <ImageUpload
 *           value={field.value}
 *           onUpload={async (file) => {
 *             const url = await uploadImage(file);
 *             field.onChange([...field.value, url]);
 *           }}
 *           onRemove={(url) => {
 *             field.onChange(field.value.filter(v => v !== url));
 *           }}
 *         />
 *       </FormControl>
 *     </FormItem>
 *   )}
 * />
 * ```
 */

export interface ImageUploadProps {
  /** Current image URLs to display as previews */
  value?: string[];
  /** Callback when files are uploaded - should return uploaded URLs or throw error */
  onUpload?: (file: File) => Promise<void>;
  /** Callback when an image is removed */
  onRemove?: (url: string) => void;
  /** Whether to allow multiple file selection */
  multiple?: boolean;
  /** Maximum file size in bytes (default: 5MB) */
  maxSize?: number;
  /** Accepted file types (default: image/jpeg,image/png,image/webp,image/gif) */
  accept?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Custom className for container */
  className?: string;
  /** Show upload progress */
  showProgress?: boolean;
  /** Custom error handler */
  onError?: (error: Error) => void;
}

interface UploadProgress {
  file: File;
  progress: number;
  preview: string;
}

export function ImageUpload({
  value = [],
  onUpload,
  onRemove,
  multiple = true,
  maxSize = 5 * 1024 * 1024, // 5MB default
  accept = 'image/jpeg,image/png,image/webp,image/gif',
  disabled = false,
  className,
  showProgress = true,
  onError,
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback(
    (file: File): string | null => {
      // Validate file type
      const validTypes = accept.split(',').map((t) => t.trim());
      if (!validTypes.includes(file.type)) {
        return `Invalid file type. Accepted types: ${accept}`;
      }

      // Validate file size
      if (file.size > maxSize) {
        const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
        return `File size exceeds ${maxSizeMB}MB limit`;
      }

      return null;
    },
    [accept, maxSize]
  );

  const createPreview = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0 || !onUpload) return;

      const filesToUpload = Array.from(files);

      // Validate all files first
      for (const file of filesToUpload) {
        const error = validateFile(file);
        if (error) {
          const err = new Error(error);
          onError?.(err);
          return;
        }
      }

      setUploading(true);

      try {
        // Create previews for progress tracking
        if (showProgress) {
          const previews = await Promise.all(
            filesToUpload.map(async (file) => ({
              file,
              progress: 0,
              preview: await createPreview(file),
            }))
          );
          setUploadProgress(previews);
        }

        // Upload files sequentially
        for (let i = 0; i < filesToUpload.length; i++) {
          const file = filesToUpload[i];

          if (showProgress) {
            setUploadProgress((prev) =>
              prev.map((p, idx) =>
                idx === i ? { ...p, progress: 50 } : p
              )
            );
          }

          await onUpload(file);

          if (showProgress) {
            setUploadProgress((prev) =>
              prev.map((p, idx) =>
                idx === i ? { ...p, progress: 100 } : p
              )
            );
          }
        }

        // Clear progress after successful upload
        setTimeout(() => {
          setUploadProgress([]);
        }, 1000);
      } catch (error) {
        const err =
          error instanceof Error ? error : new Error('Upload failed');
        onError?.(err);
        setUploadProgress([]);
      } finally {
        setUploading(false);
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [onUpload, validateFile, showProgress, createPreview, onError]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled) return;

      const files = e.dataTransfer.files;
      handleFiles(files);
    },
    [disabled, handleFiles]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
    },
    [handleFiles]
  );

  const handleRemove = useCallback(
    (url: string) => {
      if (!onRemove || disabled) return;
      onRemove(url);
    },
    [onRemove, disabled]
  );

  const triggerFileInput = useCallback(() => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  }, [disabled]);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerFileInput}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50',
          disabled && 'opacity-50 cursor-not-allowed',
          uploading && 'pointer-events-none'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileInput}
          disabled={disabled || uploading}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-2 text-center">
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : (
            <Upload className="h-8 w-8 text-muted-foreground" />
          )}
          <div className="text-sm">
            <span className="font-medium">
              {uploading ? 'Uploading...' : 'Click to upload'}
            </span>
            {!uploading && (
              <span className="text-muted-foreground">
                {' '}
                or drag and drop
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {accept
              .split(',')
              .map((t) => t.split('/')[1].toUpperCase())
              .join(', ')}{' '}
            up to {(maxSize / (1024 * 1024)).toFixed(0)}MB
          </p>
        </div>
      </div>

      {/* Upload Progress */}
      {showProgress && uploadProgress.length > 0 && (
        <div className="space-y-2">
          {uploadProgress.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50"
            >
              <div className="relative h-12 w-12 rounded overflow-hidden bg-muted flex-shrink-0">
                <Image
                  src={item.preview}
                  alt={item.file.name}
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {item.file.name}
                </p>
                <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {item.progress}%
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Grid */}
      {value.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {value.map((url, idx) => (
            <div
              key={idx}
              className="group relative aspect-square rounded-lg border overflow-hidden bg-muted"
            >
              <Image
                src={url}
                alt={`Uploaded image ${idx + 1}`}
                fill
                sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover"
                loading={idx > 3 ? 'lazy' : 'eager'}
              />
              {onRemove && (
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button
                    size="icon"
                    variant="destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(url);
                    }}
                    disabled={disabled}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {value.length === 0 && !uploading && uploadProgress.length === 0 && (
        <div className="text-center py-2">
          <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            No images uploaded yet
          </p>
        </div>
      )}
    </div>
  );
}
