declare module 'natural' {
  export class WordTokenizer {
    tokenize(text: string): string[];
  }

  export class SentenceTokenizer {
    tokenize(text: string): string[];
  }

  export class TfIdf {
    documents: string[];
    addDocument(doc: string | string[]): void;
    tfidfs(query: string | string[], callback: (i: number, tfidf: number) => void): void;
    listTerms(docIndex: number): Array<{ term: string; tfidf: number }>;
  }

  export class BayesClassifier {
    addDocument(text: string[], label: string): void;
    train(): void;
    classify(text: string[]): string;
    getClassifications(text: string[]): Array<{ label: string; value: number }>;
  }

  export class SentimentAnalyzer {
    constructor(language: string, stemmer: any, vocabulary: string);
    getSentiment(tokens: string[]): number;
  }

  export const PorterStemmer: {
    stem(word: string): string;
  };

  export const LancasterStemmer: {
    stem(word: string): string;
  };

  export const NGrams: {
    ngrams(tokens: string[], n: number): string[][];
  };
}

declare module 'stopword' {
  export type StopwordsLanguages = string[];
  export const eng: StopwordsLanguages;
  export function removeStopwords(tokens: string[], stopwords: StopwordsLanguages): string[];
}