declare module 'cheerio' {
  type Cheerio = any;
  type CheerioAPI = {
    load(html: string, options?: any): CheerioStatic;
  };
  
  interface CheerioStatic {
    (selector: string | Cheerio): Cheerio;
    html(): string;
    text(): string;
    find(selector: string): Cheerio;
    children(selector?: string): Cheerio;
    parent(): Cheerio;
    siblings(selector?: string): Cheerio;
    eq(index: number): Cheerio;
    first(): Cheerio;
    last(): Cheerio;
    get(): any[];
    each(func: (index: number, element: any) => boolean | void): Cheerio;
    map(func: (index: number, element: any) => any): Cheerio;
    filter(selector: string): Cheerio;
    not(selector: string): Cheerio;
    is(selector: string): boolean;
    attr(name: string): string;
    attr(name: string, value: string): Cheerio;
    removeAttr(name: string): Cheerio;
    hasClass(className: string): boolean;
    addClass(className: string): Cheerio;
    removeClass(className: string): Cheerio;
    toggleClass(className: string): Cheerio;
    val(): string;
    val(value: string): Cheerio;
    remove(): Cheerio;
    replaceWith(content: string): Cheerio;
    empty(): Cheerio;
    html(html: string): Cheerio;
    text(text: string): Cheerio;
    wrap(content: string): Cheerio;
    css(propertyName: string): string;
    css(propertyNames: string[]): { [key: string]: string };
    css(propertyName: string, value: string): Cheerio;
  }

  const cheerio: CheerioAPI;
  export = cheerio;
}