// Скрипт для парсинга данных с сайтов

class AirQualityParser {
    constructor() {
        this.observedElements = new Set();
        this.init();
    }

    init() {
        console.log('Эко-монитор: Инициализация парсера');
        this.startObserving();
    }

    startObserving() {
        // Начинаем наблюдение за изменениями DOM
        const observer = new MutationObserver((mutations) => {
            this.checkForAirQualityData();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: false,
            characterData: false
        });

        // Первоначальная проверка
        setTimeout(() => this.checkForAirQualityData(), 1000);
    }

    checkForAirQualityData() {
        this.parseAccuWeather();
        this.parseIQAir();
        this.parseAQICN();
    }

    parseAccuWeather() {
        // Парсинг AccuWeather
        try {
            // Ищем индекс качества воздуха
            const aqElement = document.querySelector('.aq-number, .aq-index, [data-qa="airQualityIndex"]');
            if (aqElement && !this.observedElements.has(aqElement)) {
                const aqi = parseInt(aqElement.textContent.trim());
                if (!isNaN(aqi)) {
                    this.sendData('accuweather', { aqi });
                    this.observedElements.add(aqElement);
                }
            }

            // Ищем загрязнители
            const pollutants = {};
            const pollutantElements = document.querySelectorAll('.pollutant-item, .pollutant');
            
            pollutantElements.forEach(element => {
                const text = element.textContent.toLowerCase();
                if (text.includes('pm2.5')) {
                    const match = text.match(/(\d+(\.\d+)?)/);
                    if (match) pollutants.pm2_5 = parseFloat(match[1]);
                }
                if (text.includes('pm10')) {
                    const match = text.match(/(\d+(\.\d+)?)/);
                    if (match) pollutants.pm10 = parseFloat(match[1]);
                }
                if (text.includes('no₂') || text.includes('no2')) {
                    const match = text.match(/(\d+(\.\d+)?)/);
                    if (match) pollutants.no2 = parseFloat(match[1]);
                }
                if (text.includes('o₃') || text.includes('o3')) {
                    const match = text.match(/(\d+(\.\d+)?)/);
                    if (match) pollutants.o3 = parseFloat(match[1]);
                }
                if (text.includes('so₂') || text.includes('so2')) {
                    const match = text.match(/(\d+(\.\d+)?)/);
                    if (match) pollutants.so2 = parseFloat(match[1]);
                }
                if (text.includes('co')) {
                    const match = text.match(/(\d+(\.\d+)?)/);
                    if (match) pollutants.co = parseFloat(match[1]);
                }
            });

            if (Object.keys(pollutants).length > 0) {
                this.sendData('accuweather', { components: pollutants });
            }

            // Ищем рекомендации
            const adviceElement = document.querySelector('.air-quality-text, .advice-text, .recommendation');
            if (adviceElement) {
                const recommendations = adviceElement.textContent.trim();
                this.sendData('accuweather', { recommendations });
            }

        } catch (error) {
            console.error('Ошибка парсинга AccuWeather:', error);
        }
    }

    parseIQAir() {
        // Парсинг IQAir
        try {
            const aqiElement = document.querySelector('.aqi, .index-value, .number');
            if (aqiElement) {
                const aqi = parseInt(aqiElement.textContent.trim());
                if (!isNaN(aqi)) {
                    this.sendData('iqair', { aqi });
                }
            }
        } catch (error) {
            console.error('Ошибка парсинга IQAir:', error);
        }
    }

    parseAQICN() {
        // Парсинг AQICN
        try {
            const aqiElement = document.querySelector('#aqiwgtvalue, .aqivalue, .indexValue');
            if (aqiElement) {
                const aqi = parseInt(aqiElement.textContent.trim());
                if (!isNaN(aqi)) {
                    this.sendData('aqicn', { aqi });
                }
            }
        } catch (error) {
            console.error('Ошибка парсинга AQICN:', error);
        }
    }

    sendData(source, data) {
        // Отправляем данные в background script
        chrome.runtime.sendMessage({
            action: 'airQualityData',
            source: source,
            data: data,
            url: window.location.href,
            timestamp: new Date().toISOString()
        });
    }
}

// Инициализируем парсер при загрузке страницы
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new AirQualityParser();
    });
} else {
    new AirQualityParser();
}