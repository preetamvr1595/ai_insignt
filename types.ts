
export interface DataRow {
  [key: string]: any;
}

export interface Dataset {
  name: string;
  columns: string[];
  data: DataRow[];
  id: string;
}

export type ChartType = 'bar' | 'line' | 'pie' | 'scatter' | 'none';

export interface AIResponse {
  summary: string;
  insight: string;
  chartType: ChartType;
  chartData: any[]; // Now using a unified structure: { name: string, value: number } or { x: number, y: number }
  xAxisLabel?: string;
  yAxisLabel?: string;
  suggestion?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  response?: AIResponse;
  timestamp: Date;
}

export enum AppTheme {
  LIGHT = 'light',
  DARK = 'dark'
}
