export function normalizeSearchText(value: string): string {
  return Array.from(value.normalize('NFKC').toLowerCase())
    .map((character) => {
      const code = character.charCodeAt(0);
      return code >= 0x30a1 && code <= 0x30f6
        ? String.fromCharCode(code - 0x60)
        : character;
    })
    .join('')
    .replace(/[\s　・･ー―‐-]/g, '');
}

export function matchesSchoolSearch(
  school: { name: string; name_reading?: string; aliases?: string[] },
  query: string,
): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  return [school.name, school.name_reading ?? '', ...(school.aliases ?? [])]
    .some((value) => normalizeSearchText(value).includes(normalizedQuery));
}
