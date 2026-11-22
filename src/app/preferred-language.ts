export type PreferredLanguage = 'de' | 'en';

export function getPreferredLanguage(languages: readonly string[]): PreferredLanguage {
  for (const language of languages) {
    const primaryLanguage = language.trim().split('-')[0]?.toLowerCase();
    if (primaryLanguage === 'de' || primaryLanguage === 'en') {
      return primaryLanguage;
    }
  }

  return 'de';
}
