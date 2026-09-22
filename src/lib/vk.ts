import bridge from '@vkontakte/vk-bridge';

let bridgeReady = false;

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

function appLink(): string {
  const url = new URL(window.location.href);
  url.hash = '';
  url.search = '';
  return url.toString();
}

async function browserShare(title: string, text: string, url: string): Promise<'shared' | 'copied'> {
  if (navigator.share) {
    await navigator.share({ title, text, url });
    return 'shared';
  }
  await navigator.clipboard.writeText(url);
  return 'copied';
}

export async function shareResult(name: string, shareAsset: string): Promise<'shared' | 'copied'> {
  const link = appLink();
  if (await supports('VKWebAppShowStoryBox')) {
    try {
      await (bridge.send as unknown as (method: string, params?: unknown) => Promise<unknown>)('VKWebAppShowStoryBox', {
        background_type: 'image',
        url: absoluteAsset(shareAsset),
        attachment: {
          text: 'open',
          type: 'url',
          url: link,
        },
      });
      return 'shared';
    } catch {
      // fall through
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

  return browserShare(`Я — ${name}`, 'Кто ты из учеников Академии? Пройди испытание.', link);
}

export async function inviteFriend(): Promise<'shared' | 'copied'> {
  if (await supports('VKWebAppShowInviteBox')) {
    try {
      await (bridge.send as unknown as (method: string, params?: unknown) => Promise<unknown>)('VKWebAppShowInviteBox');
      return 'shared';
    } catch {
      // fall through
    }
  }

  const link = appLink();
  if (await supports('VKWebAppShare')) {
    try {
      await (bridge.send as unknown as (method: string, params?: unknown) => Promise<unknown>)('VKWebAppShare', { link });
      return 'shared';
    } catch {
      // fall through
    }
  }
  return browserShare('Академия ждёт', 'Попробуй пройти испытание и узнать, кто ты из учеников Академии.', link);
}
