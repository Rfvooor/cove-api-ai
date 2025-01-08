import axios from 'axios';
import { Tool } from '../../core/tool.js';
import { WebScraper } from '../../utils/web-scraper.js';

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  content?: string;
}

interface SearchInput {
  query: string;
  maxResults?: number;
  scrapeContent?: boolean;
  filterDomains?: string[];
  excludeDomains?: string[];
}

interface SearchOutput {
  results: SearchResult[];
  totalResults: number;
  searchTime: number;
}

export class WebSearchTool extends Tool<SearchInput, SearchOutput> {
  private readonly apiKey: string;
  private readonly searchEngineId: string;
  private readonly webScraper: WebScraper;

  constructor(apiKey: string, searchEngineId: string) {
    const config = {
      name: 'web-search',
      description: 'Performs web searches and optionally scrapes content from results',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          maxResults: { type: 'number', optional: true },
          scrapeContent: { type: 'boolean', optional: true },
          filterDomains: { type: 'array', items: { type: 'string' }, optional: true },
          excludeDomains: { type: 'array', items: { type: 'string' }, optional: true }
        },
        required: ['query']
      } as any,
      outputSchema: {
        type: 'object',
        properties: {
          results: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                url: { type: 'string' },
                snippet: { type: 'string' },
                content: { type: 'string', optional: true }
              }
            }
          },
          totalResults: { type: 'number' },
          searchTime: { type: 'number' }
        }
      } as any,
      execute: (input: SearchInput) => this.search(input)
    };

    super(config);
    this.apiKey = apiKey;
    this.searchEngineId = searchEngineId;
    this.webScraper = new WebScraper();
  }

  private async search(input: SearchInput): Promise<SearchOutput> {
    const startTime = Date.now();
    const maxResults = input.maxResults || 10;

    try {
      // Perform Google Custom Search API request
      const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
        params: {
          key: this.apiKey,
          cx: this.searchEngineId,
          q: input.query,
          num: maxResults,
          ...(input.filterDomains && {
            siteSearch: input.filterDomains.join(','),
            siteSearchFilter: 'i'
          }),
          ...(input.excludeDomains && {
            excludeTerms: input.excludeDomains.map(domain => `site:${domain}`).join(' OR ')
          })
        }
      });

      const results: SearchResult[] = await Promise.all(
        response.data.items.map(async (item: any) => {
          const result: SearchResult = {
            title: item.title,
            url: item.link,
            snippet: item.snippet
          };

          if (input.scrapeContent) {
            try {
              result.content = await this.webScraper.scrape(item.link);
            } catch (error) {
              console.error(`Failed to scrape content from ${item.link}:`, error);
            }
          }

          return result;
        })
      );

      return {
        results,
        totalResults: response.data.searchInformation.totalResults,
        searchTime: Date.now() - startTime
      };

    } catch (error) {
      console.error('Search error:', error);
      throw new Error('Failed to perform web search');
    }
  }

  // Helper method to extract main content from HTML
  private extractMainContent(html: string): string {
    // Remove scripts, styles, and other non-content elements
    const cleanHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Extract a reasonable amount of content
    const maxLength = 1000;
    return cleanHtml.length > maxLength
      ? cleanHtml.substring(0, maxLength) + '...'
      : cleanHtml;
  }

  // Helper method to validate URLs
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  // Helper method to filter and clean search results
  private filterResults(results: SearchResult[]): SearchResult[] {
    return results
      .filter(result => this.isValidUrl(result.url))
      .map(result => ({
        ...result,
        title: result.title.trim(),
        snippet: result.snippet.trim(),
        content: result.content ? this.extractMainContent(result.content) : undefined
      }));
  }
}