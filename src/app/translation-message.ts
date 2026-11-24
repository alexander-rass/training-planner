export interface TranslationMessage {
  key: string;
  params?: Record<string, string | number>;
  detail?: TranslationMessage;
}
