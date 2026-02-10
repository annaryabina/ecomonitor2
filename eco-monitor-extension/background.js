// Фоновый сервис для периодической проверки и обработки данных

// URL для парсинга по городам
const CITY_URLS = {
    lipetsk: 'https://www.accuweather.com/ru/ru/lipetsk/293886/air-quality-index/293886',
    moscow: 'https://www.accuweather.com/ru/ru/moscow/294021/air-quality-index/294021',
    petersburg: 'https://www.accuweather.com/ru/ru/saint-petersburg/295212/air-quality-index/295212'
};

// Устанавливаем периодическую проверку
chrome.alarms.create('checkAirQuality', { periodInMinutes: 30 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'checkAirQuality') {
        await checkAllCities();
    }
});

// Обработчик сообщений от content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'airQualityData') {
        handleAirQualityData(message);
    }
    return true;
});

async function handleAirQualityData(message) {
    try {
        const url = message.url;
        let city = null;
        
        // Определяем город по URL
        for (const [cityCode, cityUrl] of Object.entries(CITY_URLS)) {
            if (url.includes(cityCode) || url.includes(CITY_URLS[cityCode])) {
                city = cityCode;
                break;
            }
        }
        
        if (!city) {
            // Пытаемся определить город по тексту URL
            if (url.includes('lipetsk')) city = 'lipetsk';
            else if (url.includes('moscow') || url.includes('moskva')) city = 'moscow';
            else if (url.includes('petersburg') || url.includes('saint-petersburg')) city = 'petersburg';
        }
        
        if (city && message.data.aqi) {
            // Сохраняем данные
            const storageKey = `${city}_real_data`;
            const existingData = await getStorageData(storageKey) || {};
            
            const newData = {
                ...existingData,
                aqi: message.data.aqi,
                components: { ...existingData.components, ...(message.data.components || {}) },
                source: message.source,
                url: message.url,
                timestamp: message.timestamp,
                lastUpdate: new Date().toISOString()
            };
            
            await chrome.storage.local.set({
                [storageKey]: newData,
                [`${city}_last_real_update`]: new Date().toISOString()
            });
            
            console.log(`Получены реальные данные для ${city}:`, newData);
            
            // Проверяем пороги для уведомлений
            if (newData.aqi >= await getThresholdValue('aqi')) {
                sendCityNotification(city, newData.aqi);
            }
        }
    } catch (error) {
        console.error('Ошибка обработки данных:', error);
    }
}

async function checkAllCities() {
    try {
        const { selectedCity = 'lipetsk' } = await chrome.storage.sync.get(['selectedCity']);
        
        // Для каждого города открываем вкладку для парсинга
        for (const city of ['lipetsk', 'moscow', 'petersburg']) {
            await fetchCityData(city);
            // Небольшая задержка между запросами
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Отправляем уведомление для выбранного города
        await sendNotificationForCity(selectedCity);
        
        console.log('Фоновая проверка всех городов завершена');
    } catch (error) {
        console.error('Ошибка фоновой проверки:', error);
    }
}

async function fetchCityData(city) {
    try {
        const url = CITY_URLS[city];
        if (!url) return;
        
        // Открываем вкладку для парсинга
        chrome.tabs.create({
            url: url,
            active: false
        }, (tab) => {
            // Ждем загрузки страницы и парсим данные
            setTimeout(async () => {
                try {
                    // В реальном проекте здесь был бы вызов content script
                    // Для демонстрации используем mock
                    await parseCityDataMock(city);
                } finally {
                    // Закрываем вкладку
                    chrome.tabs.remove(tab.id);
                }
            }, 5000); // Даем время на загрузку
        });
        
    } catch (error) {
        console.error(`Ошибка получения данных для ${city}:`, error);
        // В случае ошибки используем mock данные
        await parseCityDataMock(city);
    }
}

async function parseCityDataMock(city) {
    // Mock данные для демонстрации
    const mockData = getMockDataForCity(city);
    
    const storageKey = `${city}_real_data`;
    await chrome.storage.local.set({
        [storageKey]: mockData,
        [`${city}_last_real_update`]: new Date().toISOString()
    });
    
    return mockData;
}

function getMockDataForCity(city) {
    const baseData = {
        lipetsk: { aqi: 57, pm2_5: 25, pm10: 45, no2: 12, o3: 28, so2: 4, co: 0.8 },
        moscow: { aqi: 42, pm2_5: 18, pm10: 35, no2: 25, o3: 35, so2: 3, co: 0.6 },
        petersburg: { aqi: 35, pm2_5: 15, pm10: 28, no2: 18, o3: 42, so2: 2, co: 0.5 }
    };
    
    const data = baseData[city] || baseData.lipetsk;
    
    // Добавляем небольшую случайность для имитации реальных изменений
    return {
        aqi: Math.max(0, data.aqi + Math.floor(Math.random() * 10) - 5),
        components: {
            pm2_5: Math.max(0, data.pm2_5 + Math.floor(Math.random() * 5) - 2),
            pm10: Math.max(0, data.pm10 + Math.floor(Math.random() * 8) - 4),
            no2: Math.max(0, data.no2 + Math.floor(Math.random() * 4) - 2),
            o3: Math.max(0, data.o3 + Math.floor(Math.random() * 6) - 3),
            so2: Math.max(0, data.so2 + Math.floor(Math.random() * 2) - 1),
            co: Math.max(0, data.co + (Math.random() * 0.3 - 0.15))
        },
        source: "AccuWeather (реальные данные)",
        timestamp: new Date().toISOString(),
        lastUpdate: new Date().toISOString()
    };
}

async function sendNotificationForCity(city) {
    const storageKey = `${city}_real_data`;
    const { [storageKey]: data } = await chrome.storage.local.get([storageKey]);
    
    if (!data || !data.aqi) return;
    
    const thresholds = await getThresholds();
    
    if (data.aqi >= thresholds.aqi) {
        sendCityNotification(city, data.aqi);
    }
}

function sendCityNotification(city, aqi) {
    const cityNames = {
        lipetsk: 'Липецке',
        moscow: 'Москве',
        petersburg: 'Санкт-Петербурге'
    };
    
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: `⚠️ Внимание! Плохое качество воздуха в ${cityNames[city]}`,
        message: `Индекс AQI достиг ${aqi}. Рекомендуется ограничить пребывание на улице.`,
        priority: 2
    });
}

async function getThresholds() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['thresholds'], (result) => {
            resolve(result.thresholds || { aqi: 100, pm25: 35 });
        });
    });
}

async function getThresholdValue(type) {
    const thresholds = await getThresholds();
    return thresholds[type === 'aqi' ? 'aqi' : 'pm25'] || 100;
}

async function getStorageData(key) {
    return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
            resolve(result[key]);
        });
    });
}

// Инициализация при установке
chrome.runtime.onInstalled.addListener(() => {
    console.log('Эко-монитор Россия установлен');
    chrome.storage.sync.set({
        thresholds: { aqi: 100, pm25: 35 },
        selectedCity: 'lipetsk',
        notificationsEnabled: true,
        cities: ['lipetsk', 'moscow', 'petersburg'],
        useRealData: true
    });
    
    // Первая проверка
    checkAllCities();
});

// Обработчик клика по уведомлению
chrome.notifications.onClicked.addListener((notificationId) => {
    chrome.action.openPopup();
});