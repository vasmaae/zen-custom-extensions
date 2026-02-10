let blockedDomains = ['chat.openai.com', 'chatgpt.com', 'grok.com'];
let blockedRegions = ['RU'];

const IPINFO_TOKEN = 'a904d519b47366';
const NOTIFICATION_DEBOUNCE_TIME = 1000;
const notificationCache = new Map();

const USERINFO_CACHE_TTL = 1000;
let userInfoCache = null;
let userInfoCacheTime = 0;
let userInfoInFlight = null;

let currentListener = null;

async function initSettings() {
  try {
    const result = await browser.storage.local.get(['blockedDomains', 'blockedRegions']);

    if (Array.isArray(result.blockedDomains) && result.blockedDomains.length > 0) {
      blockedDomains = result.blockedDomains;
    } else {
      await browser.storage.local.set({ blockedDomains });
    }

    if (Array.isArray(result.blockedRegions) && result.blockedRegions.length > 0) {
      blockedRegions = result.blockedRegions;
    } else {
      await browser.storage.local.set({ blockedRegions });
    }

    registerWebRequestListener();
  } catch (error) {
    console.error('Ошибка инициализации настроек:', error);
    blockedDomains = ['chat.openai.com', 'chatgpt.com', 'grok.com'];
    blockedRegions = ['RU'];
    registerWebRequestListener();
  }
}

async function registerWebRequestListener() {
  if (currentListener) {
    browser.webRequest.onBeforeRequest.removeListener(currentListener);
  }

  const targetUrls = blockedDomains.flatMap(domain => [
    `*://${domain}/*`,
    `*://*.${domain}/*`
  ]);

  currentListener = async (details) => {
    try {
      return await blockRequest(details);
    } catch (error) {
      console.error('Ошибка в обработчике запроса:', error);
      return { cancel: false };
    }
  };

  browser.webRequest.onBeforeRequest.addListener(
    currentListener,
    { urls: targetUrls.length > 0 ? targetUrls : ['<all_urls>'] },
    ['blocking']
  );
}

async function getUserInfo() {
  try {
    const now = Date.now();

    if (userInfoCache && (now - userInfoCacheTime) < USERINFO_CACHE_TTL) {
      return userInfoCache;
    }

    if (userInfoInFlight) {
      return await userInfoInFlight;
    }

    userInfoInFlight = (async () => {
      const response = await fetch(`https://ipinfo.io/json?token=${IPINFO_TOKEN}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();

      userInfoCache = data;
      userInfoCacheTime = Date.now();

      return data;
    })();

    return await userInfoInFlight;
  } catch (error) {
    console.error('Ошибка получения данных IP:', error);
    return null;
  } finally {
    userInfoInFlight = null;
  }
}

function showNotification(userInfo) {
  const message = `IP: ${userInfo.ip}\nСтрана: ${userInfo.country}\nЧасовой пояс: ${userInfo.timezone}`;

  browser.notifications.create({
    type: 'basic',
    iconUrl: 'icon.png',
    title: '⚠️ Доступ заблокирован',
    message: message,
    priority: 2
  });
}

function shouldShowNotification(hostname) {
  const now = Date.now();
  const lastTime = notificationCache.get(hostname);

  if (lastTime && (now - lastTime) < NOTIFICATION_DEBOUNCE_TIME) {
    return false;
  }

  notificationCache.set(hostname, now);

  setTimeout(() => {
    if (notificationCache.get(hostname) === now) {
      notificationCache.delete(hostname);
    }
  }, NOTIFICATION_DEBOUNCE_TIME + 100);

  return true;
}

async function blockRequest(details) {
  try {
    const url = new URL(details.url);
    const hostname = url.hostname;

    const isBlockedDomain = blockedDomains.some(domain =>
      hostname === domain || hostname.endsWith(`.${domain}`)
    );

    if (!isBlockedDomain) {
      return { cancel: false };
    }

    const userInfo = await getUserInfo();

    if (userInfo && blockedRegions.includes(userInfo.country)) {
      if (shouldShowNotification(hostname)) {
        console.log('Заблокирован доступ к:', hostname, '| Страна:', userInfo.country);
        showNotification(userInfo);
      }

      return { cancel: true };
    }
    console.log('Доступ разрешён к:', hostname, '| Страна:', userInfo?.country || 'неизвестно');
    return { cancel: false };
  } catch (error) {
    console.error('Ошибка в blockRequest:', error);
    return { cancel: false };
  }
}

function handleStorageChanges(changes, area) {
  if (area !== 'local') return;

  let needUpdate = false;

  if (changes.blockedDomains) {
    if (Array.isArray(changes.blockedDomains.newValue) &&
      changes.blockedDomains.newValue.length > 0) {
      blockedDomains = changes.blockedDomains.newValue;
      needUpdate = true;
    }
  }

  if (changes.blockedRegions) {
    if (Array.isArray(changes.blockedRegions.newValue) &&
      changes.blockedRegions.newValue.length > 0) {
      blockedRegions = changes.blockedRegions.newValue;
      needUpdate = true;
    }
  }

  if (needUpdate) {
    console.log('Настройки обновлены, перерегистрируем listener');
    registerWebRequestListener();
  }
}

browser.browserAction.onClicked.addListener((tab) => {
  browser.runtime.openOptionsPage();
});

browser.storage.onChanged.addListener(handleStorageChanges);

browser.runtime.onInstalled.addListener(initSettings);

browser.runtime.onStartup.addListener(initSettings);

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getBlockedDomains: () => blockedDomains,
    getBlockedRegions: () => blockedRegions,
    setBlockedDomains: async (domains) => {
      await browser.storage.local.set({ blockedDomains: domains });
    },
    setBlockedRegions: async (regions) => {
      await browser.storage.local.set({ blockedRegions: regions });
    }
  };
}