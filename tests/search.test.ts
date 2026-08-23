import { describe, expect, it } from 'vitest';
import { matchesSchoolSearch, normalizeSearchText } from '../src/lib/search';

describe('school search', () => {
  it('normalizes width, spaces, punctuation, and kana', () => {
    expect(normalizeSearchText(' 芝浦工業大学・柏 ')).toBe('芝浦工業大学柏');
    expect(normalizeSearchText('レイタク')).toBe('れいたく');
  });

  it('matches official name, reading, and aliases', () => {
    const school = {
      name: '千葉県立東葛飾中学校',
      name_reading: 'ちばけんりつとうかつしかちゅうがっこう',
      aliases: ['東葛中'],
    };
    expect(matchesSchoolSearch(school, '東葛飾')).toBe(true);
    expect(matchesSchoolSearch(school, 'トウカツシカ')).toBe(true);
    expect(matchesSchoolSearch(school, '東葛 中')).toBe(true);
    expect(matchesSchoolSearch(school, '市川')).toBe(false);
  });
});
