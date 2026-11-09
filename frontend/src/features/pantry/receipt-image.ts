import { RECEIPT_IMAGE_TYPES, scaledSize } from "./receipt-scan.logic";

// Thu nhỏ ảnh hóa đơn ngay trên trình duyệt (cạnh dài ≤ 2000 px, JPEG): ảnh điện thoại 5–10 MB còn vài trăm KB, tải lên nhanh và
// bỏ luôn EXIF (canvas không giữ metadata). Safari đọc được cả ảnh HEIC của iPhone. Trình duyệt không đọc được ảnh thì gửi
// nguyên file nếu là JPG/PNG/WEBP (server kiểm lại), còn lại báo lỗi.

export async function shrinkReceiptImage(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    if (RECEIPT_IMAGE_TYPES.includes(file.type)) return file;
    throw new Error("Trình duyệt không đọc được ảnh này. Hãy chọn ảnh JPG, PNG hoặc WEBP.");
  }
  const { width, height } = scaledSize(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return file;
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  return blob ?? file;
}
