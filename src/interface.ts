// Common interfaces used across the application

// Result interface for scraper operations
export interface LgResult {
  status: boolean;
  error?: string;
  result?: string;
  markdown?: string;
  html?: string;
  answer?: string;
  gotAnswer?: boolean;
  links?: Array<{ url: string | null; text: string | null }>;
  serpData?: Array<any>;
  duration?: number;
}
