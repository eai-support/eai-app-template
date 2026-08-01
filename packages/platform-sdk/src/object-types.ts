/**
 * Canonical object-type identifier normalization shared across app/runtime SDK
 * usage. App code may use PascalCase names, while v4 resource routes are
 * kebab-case slugs.
 */
export function toObjectTypeSlug(objectType: string): string {
  return objectType
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}
