-- publicId trên Cloudinary của ảnh công thức do Admin tải lên (null với ảnh nhóm món /assets).
ALTER TABLE "Recipe" ADD COLUMN "imagePublicId" TEXT;
