document.addEventListener('DOMContentLoaded', function() {
    const elements = {
        updateTime: document.getElementById('update-time'),
        citySelect: document.getElementById('city-select'),
        cityInfo: document.getElementById('city-info'),
        aqiValue: document.getElementById('aqi-value'),
        aqiDesc: document.getElementById('aqi-desc'),
        airSource: document.getElementById('air-source'),
        pm25: document.getElementById('pm25'),
        pm10: document.getElementById('pm10'),
        no2: document.getElementById('no2'),
        o3: document.getElementById('o3'),
        so2: document.getElementById('so2'),
        co: document.getElementById('co'),
        stationName: document.getElementById('station-name'),
        stationArea: document.getElementById('station-area'),
        recommendations: document.getElementById('recommendations'),
        refreshBtn: document.getElementById('refresh-btn'),
        optionsBtn: document.getElementById('options-btn')
    };

    let currentCity = 'lipetsk';
    let refreshInterval = null;

    // Инициализация
    loadCityFromStorage();
    updateTime();
    loadData();
    startAutoRefresh();

    // Обработчики событий
    elements.citySelect.addEventListener('change', onCityChange);
    elements.refreshBtn.addEventListener('click', () => {
        loadData(true); // Принудительное обновление
        elements.refreshBtn.disabled = true;
        setTimeout(() => {
            elements.refreshBtn.disabled = false;
        }, 2000);
    });
    elements.optionsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());

    // Функции
    function updateTime() {
        const now = new Date();
        elements.updateTime.textContent = now.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function startAutoRefresh() {
        // Автообновление каждые 5 минут
        if (refreshInterval) clearInterval(refreshInterval);
        refreshInterval = setInterval(() => {
            loadData(false);
        }, 5 * 60 * 1000);
    }

    function loadCityFromStorage() {
        chrome.storage.sync.get(['selectedCity'], (result) => {
            if (result.selectedCity) {
                currentCity = result.selectedCity;
                elements.citySelect.value = currentCity;
                showCityInfo();
            }
        });
    }

    function onCityChange() {
        currentCity = elements.citySelect.value;
        saveCityToStorage();
        showCityInfo();
        loadData(true);
    }

    function saveCityToStorage() {
        chrome.storage.sync.set({ selectedCity: currentCity });
    }

    function showCityInfo() {
        const cityData = {
            lipetsk: {
                name: 'Липецк',
                info: 'Источник: AccuWeather',
                color: '#4CAF50',
                station: 'Центральный район'
            },
            moscow: {
                name: 'Москва',
                info: 'Источник: AccuWeather',
                color: '#2196F3',
                station: 'Центральный округ'
            },
            petersburg: {
                name: 'Санкт-Петербург',
                info: 'Источник: AccuWeather',
                color: '#9C27B0',
                station: 'Васильевский остров'
            }
        };

        const city = cityData[currentCity];
        elements.cityInfo.textContent = city.info;
        elements.cityInfo.className = 'city-info show';
        elements.stationArea.textContent = city.station;
        
        // Изменяем цвет заголовка
        document.querySelector('header').style.borderBottomColor = city.color;
    }

    async function loadData(forceRefresh = false) {
        try {
            showLoadingState();
            
            // Сначала пытаемся загрузить реальные данные
            const realDataKey = `${currentCity}_real_data`;
            const lastUpdateKey = `${currentCity}_last_real_update`;
            
            const data = await chrome.storage.local.get([realDataKey, lastUpdateKey]);
            
            if (data[realDataKey]) {
                displayAirQuality(data[realDataKey]);
                if (data[lastUpdateKey]) {
                    elements.updateTime.textContent = new Date(data[lastUpdateKey]).toLocaleTimeString('ru-RU');
                }
            } else {
                // Если реальных данных нет, используем mock
                await fetchRealTimeData();
            }
            
            // Если нужно принудительное обновление
            if (forceRefresh) {
                await fetchRealTimeData();
            }
            
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
            elements.aqiDesc.textContent = 'Ошибка загрузки данных';
            elements.recommendations.textContent = 'Попробуйте обновить через несколько минут';
        }
    }

    function showLoadingState() {
        elements.aqiValue.textContent = '...';
        elements.aqiDesc.textContent = 'Загрузка...';
        elements.airSource.textContent = 'Обновление данных...';
        elements.recommendations.textContent = 'Получение актуальной информации...';
    }

    async function fetchRealTimeData() {
        // Запрашиваем фоновый скрипт обновить данные
        chrome.runtime.sendMessage({
            action: 'fetchCityData',
            city: currentCity
        });
        
        // Ждем обновления данных
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Загружаем обновленные данные
        const realDataKey = `${currentCity}_real_data`;
        const lastUpdateKey = `${currentCity}_last_real_update`;
        
        const data = await chrome.storage.local.get([realDataKey, lastUpdateKey]);
        
        if (data[realDataKey]) {
            displayAirQuality(data[realDataKey]);
            if (data[lastUpdateKey]) {
                elements.updateTime.textContent = new Date(data[lastUpdateKey]).toLocaleTimeString('ru-RU');
            }
        }
    }

    function displayAirQuality(data) {
        const aqi = data.aqi || 0;
        elements.aqiValue.textContent = aqi;
        elements.aqiValue.className = 'value';
        
        // Определяем уровень загрязнения
        let description = '';
        let colorClass = '';
        let recommendations = '';
        
        if (aqi <= 50) {
            description = 'Хорошо';
            colorClass = 'good';
            recommendations = 'Воздух чистый. Можно совершать прогулки и заниматься спортом на улице.';
        } else if (aqi <= 100) {
            description = 'Умеренно';
            colorClass = 'moderate';
            recommendations = 'Умеренное загрязнение. Людям с заболеваниями дыхательных путей стоит быть осторожнее.';
        } else if (aqi <= 150) {
            description = 'Вредно для чувствительных групп';
            colorClass = 'unhealthy';
            recommendations = 'Рекомендуется ограничить пребывание на улице детям, пожилым людям и астматикам.';
        } else if (aqi <= 200) {
            description = 'Вредно';
            colorClass = 'very-unhealthy';
            recommendations = 'Всем рекомендуется ограничить время на улице, носить маску, закрыть окна.';
        } else {
            description = 'Очень вредно';
            colorClass = 'hazardous';
            recommendations = 'Опасный уровень! Оставайтесь дома, используйте очиститель воздуха.';
        }
        
        elements.aqiValue.classList.add(colorClass);
        elements.aqiDesc.textContent = description;
        
        // Добавляем город в рекомендации
        const cityName = getCityName(currentCity);
        elements.recommendations.textContent = `В ${cityName}: ${recommendations}`;
        
        // Отображаем загрязнители
        if (data.components) {
            elements.pm25.textContent = `${data.components.pm2_5 ? data.components.pm2_5.toFixed(1) : '--'} µg/m³`;
            elements.pm10.textContent = `${data.components.pm10 ? data.components.pm10.toFixed(1) : '--'} µg/m³`;
            elements.no2.textContent = `${data.components.no2 ? data.components.no2.toFixed(1) : '--'}`;
            elements.o3.textContent = `${data.components.o3 ? data.components.o3.toFixed(1) : '--'}`;
            elements.so2.textContent = `${data.components.so2 ? data.components.so2.toFixed(1) : '--'}`;
            elements.co.textContent = `${data.components.co ? data.components.co.toFixed(2) : '--'}`;
        }
        
        if (data.source) {
            elements.airSource.textContent = data.source;
        }
        
        // Отображаем информацию о станции
        elements.stationName.textContent = getStationName(currentCity);
        
        // Проверяем пороги для локальных уведомлений
        checkLocalThresholds(data);
    }

    function getCityName(cityCode) {
        const names = {
            lipetsk: 'Липецке',
            moscow: 'Москве',
            petersburg: 'Санкт-Петербурге'
        };
        return names[cityCode] || cityCode;
    }

    function getStationName(cityCode) {
        const stations = {
            lipetsk: 'Липецк-мониторинг',
            moscow: 'Москва-центр',
            petersburg: 'СПб-экология'
        };
        return stations[cityCode] || 'Мониторинговая станция';
    }

    function checkLocalThresholds(data) {
        chrome.storage.sync.get(['thresholds'], (result) => {
            const thresholds = result.thresholds || { aqi: 100, pm25: 35 };
            
            if (data.aqi >= thresholds.aqi) {
                const cityName = getCityName(currentCity);
                showLocalWarning(`⚠️ Высокий уровень AQI в ${cityName}: ${data.aqi}`);
            }
            
            if (data.components?.pm2_5 >= thresholds.pm25) {
                showLocalWarning(`⚠️ Высокий PM2.5: ${data.components.pm2_5.toFixed(1)} µg/m³`);
            }
        });
    }

    function showLocalWarning(message) {
        const warning = document.createElement('div');
        warning.className = 'local-warning';
        warning.textContent = message;
        warning.style.cssText = `
            background: #fff3cd;
            border: 1px solid #ffc107;
            border-radius: 5px;
            padding: 8px;
            margin: 10px 0;
            font-size: 12px;
            color: #856404;
        `;
        
        const existingWarning = document.querySelector('.local-warning');
        if (existingWarning) {
            existingWarning.remove();
        }
        
        elements.recommendations.parentNode.insertBefore(warning, elements.recommendations);
    }

    // Запрашиваем разрешение на уведомления
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }
    
    // Показываем информацию о городе при загрузке
    showCityInfo();
    
    // Слушаем обновления данных от background script
    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === 'dataUpdated' && message.city === currentCity) {
            loadData(false);
        }
    });
});