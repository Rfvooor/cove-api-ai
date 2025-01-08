import axios from 'axios';
import * as cheerio from 'cheerio';

export class WebScraper {
  async scrape(url: string): Promise<string> {
    try {
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);

      // Remove script, style, and other non-content tags
      $('script, style, head, nav, footer').remove();

      // Extract main content
      const mainContent = $('main, article, .content, #content')
        .text()
        .replace(/\s+/g, ' ')
        .trim();

      // Fallback to body text if no main content found
      return mainContent || $('body').text().replace(/\s+/g, ' ').trim();
    } catch (error) {
      console.error(`Error scraping ${url}:`, error);
      throw new Error(`Failed to scrape content from ${url}`);
    }
  }

  async extractImages(url: string): Promise<string[]> {
    try {
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);

      const images: string[] = [];
      $('img').each((_: any, element: any) => {
        const src = $(element).attr('src');
        if (src) {
          images.push(src);
        }
      });

      return images;
    } catch (error) {
      console.error(`Error extracting images from ${url}:`, error);
      return [];
    }
  }
}