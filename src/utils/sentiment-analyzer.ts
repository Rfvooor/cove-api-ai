import * as natural from 'natural';

export class SentimentAnalyzer {
  private tokenizer: natural.WordTokenizer;
  private sentimentAnalyzer: natural.SentimentAnalyzer;

  constructor() {
    this.tokenizer = new natural.WordTokenizer();
    this.sentimentAnalyzer = new natural.SentimentAnalyzer(
      'English', 
      natural.PorterStemmer, 
      'afinn'
    );
  }

  analyze(text: string): number {
    const tokens = this.tokenizer.tokenize(text) || [];
    const stemmedTokens = tokens.map(token => natural.PorterStemmer.stem(token));
    return this.sentimentAnalyzer.getSentiment(stemmedTokens);
  }

  classifySentiment(score: number): 'positive' | 'neutral' | 'negative' {
    if (score > 0.5) return 'positive';
    if (score < -0.5) return 'negative';
    return 'neutral';
  }
}