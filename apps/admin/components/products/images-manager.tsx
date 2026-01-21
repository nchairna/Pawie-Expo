'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  getImages,
  uploadImage,
  deleteImage,
  reorderImages,
  setPrimaryImage,
  getImageUrl,
} from '@/lib/images';
import { getProduct } from '@/lib/products';
import type { Product, ProductImage } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  Loader2,
  Upload,
  ArrowUp,
  ArrowDown,
  Star,
  Trash2,
} from 'lucide-react';

interface ImagesManagerProps {
  productId: string;
  initialImages: ProductImage[];
}

export function ImagesManager({ productId, initialImages }: ImagesManagerProps) {
  const router = useRouter();
  const [images, setImages] = useState<ProductImage[]>(initialImages);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);
  const [reorderingImages, setReorderingImages] = useState(false);

  const handleUploadImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const files = Array.from(e.target.files);
    setUploadingImages(true);

    try {
      for (const file of files) {
        await uploadImage(productId, file);
      }
      toast.success(`Successfully uploaded ${files.length} image(s)`);
      // Refresh images
      const data = await getImages(productId);
      setImages(data);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload images');
    } finally {
      setUploadingImages(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const handleDeleteImage = async (image: ProductImage) => {
    if (!confirm('Are you sure you want to delete this image?')) {
      return;
    }

    try {
      setDeletingImageId(image.id);
      await deleteImage(image.id, productId);
      toast.success('Image deleted successfully');
      // Refresh images
      const data = await getImages(productId);
      setImages(data);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete image');
    } finally {
      setDeletingImageId(null);
    }
  };

  const handleSetPrimary = async (image: ProductImage) => {
    try {
      await setPrimaryImage(image.id, productId);
      toast.success('Primary image updated');
      // Refresh images
      const data = await getImages(productId);
      setImages(data);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to set primary image');
    }
  };

  const handleMoveImage = async (image: ProductImage, direction: 'up' | 'down') => {
    if (reorderingImages) return;

    const currentIndex = images.findIndex((img) => img.id === image.id);
    if (
      (direction === 'up' && currentIndex === 0) ||
      (direction === 'down' && currentIndex === images.length - 1)
    ) {
      return;
    }

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const newImages = [...images];
    const [moved] = newImages.splice(currentIndex, 1);
    newImages.splice(newIndex, 0, moved);

    // Update sort_order for all affected images
    const imageOrders = newImages.map((img, idx) => ({
      id: img.id,
      sort_order: idx,
    }));

    try {
      setReorderingImages(true);
      await reorderImages(productId, imageOrders);
      // Refresh images
      const data = await getImages(productId);
      setImages(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to reorder images');
    } finally {
      setReorderingImages(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Product Images</CardTitle>
            <CardDescription>
              Upload and manage product images. The first image will be set as
              primary automatically.
            </CardDescription>
          </div>
          <div className="relative">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              onChange={handleUploadImages}
              disabled={uploadingImages}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              id="image-upload"
            />
            <Button asChild disabled={uploadingImages}>
              <label
                htmlFor="image-upload"
                className="cursor-pointer disabled:cursor-not-allowed"
              >
                {uploadingImages ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Images
                  </>
                )}
              </label>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {images.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <p className="text-sm text-muted-foreground mb-4">
              No images yet. Upload your first product image.
            </p>
            <div className="relative inline-block">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                onChange={handleUploadImages}
                disabled={uploadingImages}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                id="image-upload-empty"
              />
              <Button
                variant="outline"
                asChild
                disabled={uploadingImages}
              >
                <label
                  htmlFor="image-upload-empty"
                  className="cursor-pointer disabled:cursor-not-allowed"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Images
                </label>
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map((image, index) => (
              <div
                key={image.id}
                className="relative group border rounded-lg overflow-hidden bg-muted"
              >
                <div className="aspect-square relative">
                  <Image
                    src={getImageUrl(image.path)}
                    alt={image.alt_text || 'Product image'}
                    fill
                    sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="object-cover"
                    priority={index === 0}
                  />
                  {image.is_primary && (
                    <div className="absolute top-2 left-2 bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
                      <Star className="h-3 w-3 fill-current" />
                      Primary
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      size="icon"
                      variant="secondary"
                      onClick={() => handleSetPrimary(image)}
                      disabled={image.is_primary}
                      title="Set as primary"
                    >
                      <Star
                        className={`h-4 w-4 ${
                          image.is_primary ? 'fill-current' : ''
                        }`}
                      />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      onClick={() => handleMoveImage(image, 'up')}
                      disabled={index === 0 || reorderingImages}
                      title="Move up"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      onClick={() => handleMoveImage(image, 'down')}
                      disabled={index === images.length - 1 || reorderingImages}
                      title="Move down"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="destructive"
                      onClick={() => handleDeleteImage(image)}
                      disabled={deletingImageId === image.id}
                      title="Delete"
                    >
                      {deletingImageId === image.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="p-2 text-xs text-muted-foreground text-center">
                  Order: {image.sort_order + 1}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
