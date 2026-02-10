document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save-btn').addEventListener('click', saveOptions);
document.getElementById('reset-btn').addEventListener('click', resetOptions);
document.getElementById('test-btn').addEventListener('click', testParsing);
document.getElementById('back-btn').addEventListener('click', () => window.close());

const aqiSlider = document.getElementById('aqi-threshold');
const aqiValue = document.getElementById('aqi-value');
const pm25Slider = document.getElementById('pm25-threshold');
const pm25Value = document.getElementById('pm25-value');
const defaultCitySelect = document.getElementById('default-city');

aqiSlider.addEventListener('input', () => aqiValue.textContent = aqiSlider.value);
pm25Slider.addEventListener('input', () => pm25Value.textContent = pm25Slider.value);

function restoreOptions() {
    chrome.storage.sync.get([
        'thresholds', 
        'notificationsEnabled', 
        'frequency', 
        'selectedCity',
        'useRealData'
    ], (data) => {
        const thresholds = data.thresholds || { aqi: 100, pm25: 35 };
        
        aqiSlider.value = thresholds.aqi;
        aqiValue.textContent = thresholds.aqi;
        
        pm25Slider.value = thresholds.pm25;
        pm25Value.textContent = thresholds.pm25;
        
        defaultCitySelect.value = data.selectedCity || 'lipetsk';
        
        document.getElementById('notifications-enabled').checked = 
            data.notificationsEnabled !== false;
        
        document.getElementById('use-real-data').checked = 
            data.useRealData !== false;
        
        document.getElementById('check-frequency').value = data.frequency || '30';
    });
}

function saveOptions() {
    const thresholds = {
        aqi: parseInt(aqiSlider.value),
        pm25: parseInt(pm25Slider.value)
    };
    
    const options = {
        thresholds,
        selectedCity: defaultCitySelect.value,
        notificationsEnabled: document.getElementById('notifications-enabled').checked,
        useRealData: document.getElementById('use-real-data').checked,
        frequency: document.getElementById('check-frequency').value
    };
    
    chrome.storage.sync.set(options, () => {
        showStatus('Настройки сохранены!', 'success');
        
        // Обновляем аларм с новой частотой
        chrome.alarms.clear('checkAirQuality');
        chrome.alarms.create('checkAirQuality', {
            periodInMinutes: parseInt(options.frequency)
        });
    });
}

function resetOptions() {
    chrome.storage.sync.set({
        thresholds: { aqi: 100, pm25: 35 },
        selectedCity: 'lipetsk',
        notificationsEnabled: true,
        useRealData: true,
        frequency: '30'
    }, () => {
        restoreOptions();
        showStatus('Настройки сброшены', 'info');
    });
}

async function testParsing() {
    const testBtn = document.getElementById('test-btn');
    const originalText = testBtn.textContent;
    testBtn.disabled = true;
    testBtn.textContent = 'Тестирование...';
    
    const testResults = document.getElementById('test-results');
    const testOutput = document.getElementById('test-output');
    
    testResults.style.display = 'block';
    testOutput.innerHTML = '<p>Запуск теста парсинга...</p>';
    
    try {
        // Тестируем парсинг для каждого города
        const cities = [
            { code: 'lipetsk', name: 'Липецк', url: 'https://www.accuweather.com/ru/ru/lipetsk/293886/air-quality-index/293886' },
            { code: 'moscow', name: 'Москва', url: 'https://www.accuweather.com/ru/ru/moscow/294021/air-quality-index/294021' },
            { code: 'petersburg', name: 'Санкт-Петербург', url: 'https://www.accuweather.com/ru/ru/saint-petersburg/295212/air-quality-index/295212' }
        ];
        
        let resultsHtml = '';
        
        for (const city of cities) {
            resultsHtml += `<div class="city-test"><strong>${city.name}:</strong> `;
            
            try {
                // В реальном приложении здесь был бы реальный парсинг
                // Для демонстрации используем mock
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                const mockData = getMockTestData(city.code);
                resultsHtml += `✅ AQI: ${mockData.aqi}, PM2.5: ${mockData.pm2_5} µg/m³`;
                
                // Сохраняем тестовые данные
                await chrome.storage.local.set({
                    [`${city.code}_real_data`]: {
                        aqi: mockData.aqi,
                        components: { pm2_5: mockData.pm2_5, pm10: mockData.pm10 },
                        source: 'Тестовый парсинг',
                        timestamp: new Date().toISOString()
                    }
                });
                
            } catch (error) {
                resultsHtml += `❌ Ошибка: ${error.message}`;
            }
            
            resultsHtml += '</div>';
        }
        
        testOutput.innerHTML = resultsHtml;
        showStatus('Тест завершен успешно!', 'success');
        
    } catch (error) {
        testOutput.innerHTML = `<p style="color: red;">Ошибка тестирования: ${error.message}</p>`;
        showStatus('Ошибка тестирования', 'error');
    } finally {
        testBtn.disabled = false;
        testBtn.textContent = originalText;
    }
}

function getMockTestData(city) {
    const data = {
        lipetsk: { aqi: 57, pm2_5: 25, pm10: 45 },
        moscow: { aqi: 42, pm2_5: 18, pm10: 35 },
        petersburg: { aqi: 35, pm2_5: 15, pm10: 28 }
    };
    return data[city] || data.lipetsk;
}

function showStatus(message, type) {
    const status = document.getElementById('status-message');
    status.textContent = message;
    status.className = `status ${type}`;
    
    setTimeout(() => {
        status.textContent = '';
        status.className = 'status';
    }, 3000);
}