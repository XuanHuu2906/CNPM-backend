import { v2 as cloudinary, UploadApiResponse, UploadApiOptions } from 'cloudinary';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { InternalServerError } from '../utils/apiResponse';

cloudinary.config({
  url: env.CLOUDINARY_URL,
});

export class UploadService {
  /**
   * Upload file từ buffer lên Cloudinary
   */
  async uploadFromBuffer(
    buffer: Buffer,
    options: { folder?: string; publicId?: string; resourceType?: 'image' | 'raw' | 'auto' } = {}
  ): Promise<UploadApiResponse> {
    const uploadOptions: UploadApiOptions = {
      folder: options.folder ?? 'uploads',
      resource_type: options.resourceType ?? 'auto',
      ...(options.publicId && { public_id: options.publicId }),
    };

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
        if (error) {
          logger.error(`Cloudinary upload failed: ${error.message}`);
          reject(new InternalServerError('Tải file lên thất bại'));
        } else if (result) {
          resolve(result);
        }
      });
      stream.end(buffer);
    });
  }

  /**
   * Upload file từ đường dẫn local lên Cloudinary
   */
  async uploadFromPath(
    filePath: string,
    options: { folder?: string; publicId?: string; resourceType?: 'image' | 'raw' | 'auto' } = {}
  ): Promise<UploadApiResponse> {
    const uploadOptions: UploadApiOptions = {
      folder: options.folder ?? 'uploads',
      resource_type: options.resourceType ?? 'auto',
      ...(options.publicId && { public_id: options.publicId }),
    };

    try {
      const result = await cloudinary.uploader.upload(filePath, uploadOptions);
      return result;
    } catch (error: any) {
      logger.error(`Cloudinary upload failed: ${error.message}`);
      throw new InternalServerError('Tải file lên thất bại');
    }
  }

  /**
   * Xóa file trên Cloudinary theo public_id
   */
  async deleteFile(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (error: any) {
      logger.error(`Cloudinary delete failed: ${error.message}`);
      throw new InternalServerError('Xóa file thất bại');
    }
  }
}

export const uploadService = new UploadService();
