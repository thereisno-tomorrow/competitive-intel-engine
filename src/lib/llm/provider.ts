export interface LLMProvider {
  classifyStructured<T>(prompt: string): Promise<T>;
  generateStructured<T>(prompt: string, context: Record<string, unknown>, options?: { fast?: boolean }): Promise<T>;
}
