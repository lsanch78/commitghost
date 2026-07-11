export interface GenerateOptions {
  diff: string;
  filesChanged: string[];
  recentSubjects: string[];
  style?: string;
  candidateCount: number;
  model?: string;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export interface GenerateResult {
  candidates: string[];
  usage: Usage;
}

export interface Provider {
  name: string;
  generate(options: GenerateOptions): Promise<GenerateResult>;
}
