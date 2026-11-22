import { getPreferredLanguage } from './preferred-language';

describe('getPreferredLanguage', () => {
  it('uses the first supported browser language', () => {
    expect(getPreferredLanguage(['fr-CA', 'en-US', 'de-DE'])).toBe('en');
    expect(getPreferredLanguage(['de-DE', 'en-US'])).toBe('de');
  });

  it('defaults to German when no supported language is preferred', () => {
    expect(getPreferredLanguage(['fr-CA', 'es-ES'])).toBe('de');
    expect(getPreferredLanguage([])).toBe('de');
  });
});
