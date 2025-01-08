import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import sharp from 'sharp';

export interface ImageProcessingOptions {
  maxWidth?: number;
  maxHeight?: number;
  format?: 'jpeg' | 'png' | 'webp';
  quality?: number;
}

export class ImageHandler {
  private storageDir: string;

  constructor(storageDir: string = './artifacts/images') {
    this.storageDir = storageDir;
  }

  // Download image from URL
  async downloadImage(url: string): Promise<string> {
    try {
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      const hash = this.generateHash(url);
      const ext = this.getFileExtension(url);
      const filename = `${hash}.${ext}`;
      const filepath = path.join(this.storageDir, filename);

      // Ensure storage directory exists
      await fs.mkdir(this.storageDir, { recursive: true });

      // Save image
      await fs.writeFile(filepath, response.data);
      return filepath;
    } catch (error) {
      console.error(`Error downloading image from ${url}:`, error);
      throw new Error(`Failed to download image: ${url}`);
    }
  }

  // Process image with optional transformations
  async processImage(
    imagePath: string, 
    options: ImageProcessingOptions = {}
  ): Promise<string> {
    try {
      const { 
        maxWidth = 1920, 
        maxHeight = 1080, 
        format = 'webp', 
        quality = 80 
      } = options;

      const hash = this.generateHash(imagePath);
      const outputPath = path.join(
        this.storageDir, 
        `processed_${hash}.${format}`
      );

      await sharp(imagePath)
        .resize(maxWidth, maxHeight, { fit: 'inside', withoutEnlargement: true })
        .toFormat(format, { quality })
        .toFile(outputPath);

      return outputPath;
    } catch (error) {
      console.error(`Error processing image ${imagePath}:`, error);
      throw new Error(`Failed to process image: ${imagePath}`);
    }
  }

  // Extract text from images using OCR
  async extractText(imagePath: string): Promise<string> {
    try {
      // Note: This requires Tesseract OCR to be installed
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker();
      
      const { data: { text } } = await worker.recognize(imagePath);
      await worker.terminate();

      return text.trim();
    } catch (error) {
      console.error(`Error extracting text from image ${imagePath}:`, error);
      throw new Error(`Failed to extract text from image: ${imagePath}`);
    }
  }

  // Generate a unique hash for a given input
  private generateHash(input: string): string {
    return createHash('md5').update(input).digest('hex');
  }

  // Get file extension from URL or path
  private getFileExtension(urlOrPath: string): string {
    const ext = path.extname(urlOrPath).toLowerCase().slice(1);
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) ? ext : 'jpg';
  }

  // List all images in storage directory
  async listImages(): Promise<string[]> {
    try {
      return await fs.readdir(this.storageDir);
    } catch (error) {
      console.error('Error listing images:', error);
      return [];
    }
  }

  // Delete an image
  async deleteImage(filename: string): Promise<void> {
    try {
      const filepath = path.join(this.storageDir, filename);
      await fs.unlink(filepath);
    } catch (error) {
      console.error(`Error deleting image ${filename}:`, error);
    }
  }
}