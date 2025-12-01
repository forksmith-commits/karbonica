import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';

export interface UploadFileOptions {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  folder?: string;
}

export interface UploadFileResult {
  fileUrl: string;
  fileSize: number;
  key: string;
}

export class StorageService {
  private supabase: SupabaseClient;
  private bucket: string;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    this.bucket = process.env.SUPABASE_STORAGE_BUCKET || 'project-documents';

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL and Service Role Key are required');
    }

    // Initialize Supabase client with service role key for admin access
    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    logger.info('Storage service initialized', {
      service: 'StorageService',
      provider: 'supabase',
      bucket: this.bucket,
    });
  }

  /**
   * Upload a file to Supabase Storage
   */
  async uploadFile(options: UploadFileOptions): Promise<UploadFileResult> {
    const { buffer, filename, mimeType, folder = 'documents' } = options;

    // Generate unique key
    const fileExtension = filename.split('.').pop();
    const uniqueFilename = `${uuidv4()}.${fileExtension}`;
    const key = `${folder}/${uniqueFilename}`;

    try {
      // Upload to Supabase Storage
      const { error } = await this.supabase.storage.from(this.bucket).upload(key, buffer, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: false,
      });

      if (error) {
        throw error;
      }

      // Get public URL
      const { data: urlData } = this.supabase.storage.from(this.bucket).getPublicUrl(key);

      logger.info('File uploaded successfully', {
        service: 'StorageService',
        key,
        fileSize: buffer.length,
        mimeType,
      });

      return {
        fileUrl: urlData.publicUrl,
        fileSize: buffer.length,
        key,
      };
    } catch (error) {
      logger.error('Failed to upload file', {
        service: 'StorageService',
        error: error instanceof Error ? error.message : 'Unknown error',
        key,
      });
      throw new Error('Failed to upload file to storage');
    }
  }

  /**
   * Delete a file from Supabase Storage
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const { error } = await this.supabase.storage.from(this.bucket).remove([key]);

      if (error) {
        throw error;
      }

      logger.info('File deleted successfully', {
        service: 'StorageService',
        key,
      });
    } catch (error) {
      logger.error('Failed to delete file', {
        service: 'StorageService',
        error: error instanceof Error ? error.message : 'Unknown error',
        key,
      });
      throw new Error('Failed to delete file from storage');
    }
  }

  /**
   * Check if a file exists in storage
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucket)
        .list(key.split('/')[0], {
          search: key.split('/')[1],
        });

      if (error) {
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(key: string): Promise<{ size: number; contentType: string } | null> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucket)
        .list(key.split('/')[0], {
          search: key.split('/')[1],
        });

      if (error || !data || data.length === 0) {
        return null;
      }

      const file = data[0];
      return {
        size: file.metadata?.size || 0,
        contentType: file.metadata?.mimetype || 'application/octet-stream',
      };
    } catch (error) {
      logger.error('Failed to get file metadata', {
        service: 'StorageService',
        error: error instanceof Error ? error.message : 'Unknown error',
        key,
      });
      return null;
    }
  }

  /**
   * Create a signed URL for temporary access to a file
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string | null> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucket)
        .createSignedUrl(key, expiresIn);

      if (error) {
        throw error;
      }

      return data.signedUrl;
    } catch (error) {
      logger.error('Failed to create signed URL', {
        service: 'StorageService',
        error: error instanceof Error ? error.message : 'Unknown error',
        key,
      });
      return null;
    }
  }
}
