/** These requests begin with the entrance gesture, independently of the 3D module. */
export function decodePainting(url: string, priority: 'high' | 'auto' = 'auto'): Promise<HTMLImageElement | null> {
  const image = new Image();
  image.fetchPriority = priority;
  image.decoding = 'async';
  image.src = url;
  return image.decode().then(() => image, () => null);
}

export function prepareEntryArt(base: string) {
  const panorama = decodePainting(base + '/world/immortal-mountains-panorama.webp', 'high');
  const sky = decodePainting(base + '/world/cloud-court-sky.webp');
  const fonts = document.fonts?.load('500 48px "Courtyard Lettering"').catch(() => {});
  return { panorama, sky, fonts };
}

export type EntryArt = ReturnType<typeof prepareEntryArt>;
