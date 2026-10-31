import { publicAssetUrl } from './assets';

/** Offer the result's ready-made vertical share card as a normal file. */
export function downloadResultCard(storyAsset: string, characterId: string): void {
  const anchor = document.createElement('a');
  anchor.href = publicAssetUrl(storyAsset);
  anchor.download = `academy-result-${characterId}.webp`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
