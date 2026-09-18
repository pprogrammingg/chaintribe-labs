/** Paging helpers. Callers fetch bodies; this module only slices catalogs. */

export const TOC_PAGE = 5;
export const ARTICLE_BATCH = 2;
export const NEIGHBOR_RADIUS = 1;

export function pageSlice(items, page, size) {
  const start = page * size;
  if (page < 0 || start >= items.length) return { slice: [], nextPage: null };
  return {
    slice: items.slice(start, start + size),
    nextPage: start + size < items.length ? page + 1 : null,
  };
}

export function neighborWindow(items, id, radius = NEIGHBOR_RADIUS) {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return [];
  return items.slice(Math.max(0, index - radius), Math.min(items.length, index + radius + 1));
}

export function extendForward(items, loadedIds, count) {
  let max = -1;
  items.forEach((item, index) => {
    if (loadedIds.has(item.id)) max = index;
  });
  const out = [];
  for (let i = max + 1; i < items.length && out.length < count; i += 1) out.push(items[i]);
  return out;
}

export function fillEarlierGaps(items, loadedIds, count) {
  let max = -1;
  items.forEach((item, index) => {
    if (loadedIds.has(item.id)) max = Math.max(max, index);
  });
  const out = [];
  for (let i = 0; i < max && out.length < count; i += 1) {
    if (!loadedIds.has(items[i].id)) out.push(items[i]);
  }
  return out;
}
