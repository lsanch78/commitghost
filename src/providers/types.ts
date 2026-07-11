export interface GenerateOptions {
  diff: string;
  filesChanged: string[];
  recentSubjects: string[];
  style?: string;
  candidateCount: number;
  model?: string;
}

export interface Provider {
  name: string;
  generate(options: GenerateOptions): Promise<string[]>;
}
