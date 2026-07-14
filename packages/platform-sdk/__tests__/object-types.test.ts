import { toObjectTypeSlug } from '../src/object-types';

describe('toObjectTypeSlug', () => {
  it('converts PascalCase names to kebab-case slugs', () => {
    expect(toObjectTypeSlug('WatchTarget')).toBe('watch-target');
  });

  it('handles consecutive capitals, underscores, spaces, and repeated separators', () => {
    expect(toObjectTypeSlug('APIKey')).toBe('api-key');
    expect(toObjectTypeSlug('Sent_Post')).toBe('sent-post');
    expect(toObjectTypeSlug('  Feed  Item  ')).toBe('feed-item');
    expect(toObjectTypeSlug('Draft--Item')).toBe('draft-item');
  });
});
