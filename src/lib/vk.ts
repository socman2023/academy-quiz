import bridge from '@vkontakte/vk-bridge';

let bridgeReady = false;

export type ShareMode = 'story' | 'wall';
export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'unavailable';

export async function initVK(): Promise<void> {
  try {
    await bridge.send('VKWebAppInit');
    bridgeReady = true;
  } catch {
    bridgeReady = false;
  }
}

async function supports(method: string): Promise<boolean> {
  if (!bridgeReady) return false;
  try {
    return Boolean(await (bridge.supportsAsync as unknown as (m: string) => Promise<boolean>)(method));
  } catch {
    return false;
  }
}

function absoluteAsset(path: string): string {
  return new URL(path.replace(/^\//, ''), window.location.href).toString();
}

const VK_APP_ID = 54787284;
const VK_APP_LINK = `https://vk.com/app${VK_APP_ID}`;

function isDevelopmentHosting(): boolean {
  return window.location.hostname.startsWith('stage-app');
}

function appLink(): string {
  // While the app is unpublished, VK may drop vk.com/app... from share
  // payloads. The stage-hosting URL is a normal reachable URL and works in dev.
  if (isDevelopmentHosting()) {
    const url = new URL(window.location.href);
    url.hash = '';
    url.search = '';
    return url.toString();
  }
  return VK_APP_LINK;
}

function buildWallMessage(name: string, link: string): string {
  return `Я — ${name}. Узнай и ты, кто ты из учеников Академии. ${link}`;
}

async function browserShare(title: string, text: string, url: string): Promise<'shared' | 'copied'> {
  if (navigator.share) {
    await navigator.share({ title, text, url });
    return 'shared';
  }
  await navigator.clipboard.writeText(url);
  return 'copied';
}

function isUserDenied(error: unknown): boolean {
  try {
    const text = JSON.stringify(error).toLowerCase();
    return text.includes('user denied')
      || text.includes('"error_code":4')
      || text.includes('cancel');
  } catch {
    return false;
  }
}

async function imageAssetToJpegDataUrl(path: string): Promise<string> {
  const response = await fetch(absoluteAsset(path), { cache: 'force-cache' });
  if (!response.ok) throw new Error(`Unable to load story image: ${response.status}`);

  const sourceBlob = await response.blob();
  const objectUrl = URL.createObjectURL(sourceBlob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Unable to decode story image'));
      img.src = objectUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable');

    context.drawImage(image, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.94);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function shareResult(
  name: string,
  storyAsset: string,
  wallAsset: string,
  mode: ShareMode,
): Promise<ShareResult> {
  const link = appLink();

  if (mode === 'story' && await supports('VKWebAppShowStoryBox')) {
    try {
      // VK StoryBox explicitly accepts PNG/JPEG base64 blobs. Our cards are
      // stored as WebP for the app, so convert only the selected card at share time.
      const blob = await imageAssetToJpegDataUrl(storyAsset);
      await (bridge.send as unknown as (method: string, params?: unknown) => Promise<unknown>)('VKWebAppShowStoryBox', {
        background_type: 'image',
        blob,
        locked: true,
        attachment: {
          text: 'open',
          type: 'url',
          url: link,
        },
      });
      return 'shared';
    } catch (error) {
      // Closing the native editor is a normal user action. Do not open the
      // generic VK share dialog immediately afterwards.
      if (isUserDenied(error)) return 'cancelled';
      throw error;
    }
  }

  if (mode === 'wall') {
    // VK currently blocks wall posting for this unpublished development app.
    // Do not open a misleading generic "share to messages" dialog in dev.
    if (isDevelopmentHosting()) return 'unavailable';

    try {
      await (bridge.send as unknown as (method: string, params?: unknown) => Promise<unknown>)('VKWebAppShowWallPostBox', {
        message: buildWallMessage(name, link),
        attachments: link,
        upload_attachments: [{
          type: 'photo',
          link: absoluteAsset(wallAsset),
        }],
      });
      return 'shared';
    } catch (error) {
      if (isUserDenied(error)) return 'cancelled';

      // Some VK runtimes reject URL-uploaded photos. Keep one native wall-only
      // retry, but never fall back to VKWebAppShare (which is a message/share dialog).
      try {
        await (bridge.send as unknown as (method: string, params?: unknown) => Promise<unknown>)('VKWebAppShowWallPostBox', {
          message: buildWallMessage(name, link),
        });
        return 'shared';
      } catch (fallbackError) {
        if (isUserDenied(fallbackError)) return 'cancelled';
        throw fallbackError;
      }
    }
  }

  if (await supports('VKWebAppShare')) {
    try {
      await (bridge.send as unknown as (method: string, params?: unknown) => Promise<unknown>)('VKWebAppShare', { link });
      return 'shared';
    } catch {
      // fall through
    }
  }

  const text = mode === 'story'
    ? 'Кто ты из учеников Академии? Пройди испытание.'
    : `Я — ${name}. Узнай и ты, кто ты из учеников Академии.`;
  return browserShare(`Я — ${name}`, text, link);
}

export async function inviteFriend(): Promise<'shared' | 'copied'> {
  const link = appLink();

  if (await supports('VKWebAppShare')) {
    try {
      await (bridge.send as unknown as (method: string, params?: unknown) => Promise<unknown>)('VKWebAppShare', { link });
      return 'shared';
    } catch {
      // fall through
    }
  }

  return browserShare(
    'Академия ждёт',
    'Попробуй пройти испытание и узнать, кто ты из учеников Академии.',
    link,
  );
}
