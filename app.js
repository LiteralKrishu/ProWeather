// API Configuration
const API_KEY = '58492a93fdc9d0889463aecdd2887a95';
const BASE_URL = 'https://api.openweathermap.org/data/2.5';
const GEOCODING_URL = 'https://api.openweathermap.org/geo/1.0/direct';
const ICON_URL = 'https://openweathermap.org/img/wn/';

// DOM Elements
const citySearch = document.getElementById('city-search');
const searchResults = document.getElementById('search-results');
const geolocationBtn = document.getElementById('geolocation-btn');
const currentCity = document.getElementById('current-city');
const currentDate = document.getElementById('current-date');
const currentTemp = document.getElementById('current-temp');
const weatherIcon = document.getElementById('weather-icon').querySelector('img');
const weatherDescription = document.getElementById('weather-description');
const humidity = document.getElementById('humidity');
const windSpeed = document.getElementById('wind-speed');
const uvIndex = document.getElementById('uv-index');
const rainfall = document.getElementById('rainfall');
const pressure = document.getElementById('pressure');
const visibility = document.getElementById('visibility');
const sunriseTime = document.getElementById('sunrise-time');
const sunsetTime = document.getElementById('sunset-time');
const tempUnitButtons = document.querySelectorAll('.temp-unit-toggle button');
const loadingOverlay = document.querySelector('.loading-overlay');
const weatherMap = document.getElementById('weather-map');
const hourlyScroll = document.querySelector('.hourly-scroll');
const forecastDays = document.querySelector('.forecast-days');
const cityList = document.querySelector('.city-list');
const uvIndicator = document.querySelector('.uv-indicator');
const uvAdvice = document.querySelector('.uv-advice');
const aqiIndicator = document.querySelector('.aqi-indicator');
const aqiValue = document.querySelector('.aqi-value');
const aqiAdvice = document.querySelector('.aqi-advice');
const todayBar = document.querySelector('.comparison-bar.today');
const yesterdayBar = document.querySelector('.comparison-bar.yesterday');
const themeToggle = document.getElementById('theme-toggle');
const weatherBackground = document.querySelector('.weather-background');
const hourlyTab = document.getElementById('hourly-tab');
const dailyTab = document.getElementById('daily-tab');
const hourlySection = document.getElementById('hourly-section');
const dailySection = document.getElementById('daily-section');
const dailyScroll = document.querySelector('.daily-scroll');

// Global Variables
let currentUnit = 'c';
let map;
let markers = [];
let currentWeatherData = null;
let hourlyForecastData = null;
let dailyForecastData = null;
let airQualityData = null;
let historicalData = null;
let popularCities = [
    { name: 'Kyoto, Japan', lat: 35.0116, lon: 135.7681 },
    { name: 'Antalya, Turkey', lat: 36.8969, lon: 30.7133 },
    { name: 'Tokyo, Japan', lat: 35.6762, lon: 139.6503 }
];
let daily8ForecastData = null;

// Initialize the application
function init() {
    setupEventListeners();
    initMap();
    setCurrentDate();
    setupTheme();
    checkGeolocation();
    createWeatherBackground();
}

// Set up event listeners
function setupEventListeners() {
    citySearch.addEventListener('input', debounce(handleCitySearch, 300));
    geolocationBtn.addEventListener('click', handleGeolocation);
    tempUnitButtons.forEach(button => {
        button.addEventListener('click', () => handleUnitChange(button));
    });
    themeToggle.addEventListener('click', toggleTheme);
    
    // Keyboard navigation for search results
    citySearch.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            const results = document.querySelectorAll('.search-result-item');
            if (results.length > 0) {
                e.preventDefault();
                let currentIndex = -1;

                results.forEach((result, index) => {
                    if (result.classList.contains('highlighted')) {
                        currentIndex = index;
                        result.classList.remove('highlighted');
                    }
                });

                if (e.key === 'ArrowDown') {
                    const nextIndex = (currentIndex + 1) % results.length;
                    results[nextIndex].classList.add('highlighted');
                    results[nextIndex].scrollIntoView({ block: 'nearest' });
                } else if (e.key === 'ArrowUp') {
                    const prevIndex = (currentIndex - 1 + results.length) % results.length;
                    results[prevIndex].classList.add('highlighted');
                    results[prevIndex].scrollIntoView({ block: 'nearest' });
                }
            }
        } else if (e.key === 'Enter') {
            const highlighted = document.querySelector('.search-result-item.highlighted');
            if (highlighted) {
                highlighted.click();
            }
        }
    });

    // Mutation observer to highlight first search result
    const observer = new MutationObserver(() => {
        const results = document.querySelectorAll('.search-result-item');
        if (results.length > 0) {
            // Remove highlight from all first
            results.forEach(r => r.classList.remove('highlighted'));
            results[0].classList.add('highlighted');
        }
    });
    observer.observe(searchResults, { childList: true });
    
    // Forecast tab switching
    hourlyTab.addEventListener('click', () => {
        hourlyTab.classList.add('active');
        dailyTab.classList.remove('active');
        hourlySection.style.display = '';
        dailySection.style.display = 'none';
    });
    dailyTab.addEventListener('click', () => {
        dailyTab.classList.add('active');
        hourlyTab.classList.remove('active');
        hourlySection.style.display = 'none';
        dailySection.style.display = '';
    });
}

// Check for geolocation on load
function checkGeolocation() {
    if (navigator.geolocation) {
        showLoading();
        navigator.geolocation.getCurrentPosition(
            position => {
                const { latitude, longitude } = position.coords;
                fetch(`https://api.openweathermap.org/geo/1.0/reverse?lat=${latitude}&lon=${longitude}&limit=1&appid=${API_KEY}`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.length > 0) {
                            const city = data[0];
                            fetchWeatherData(latitude, longitude, `${city.name}, ${city.country}`);
                        } else {
                            fetchWeatherData(latitude, longitude, 'Your Location');
                        }
                    })
                    .catch(error => {
                        console.error('Error fetching location name:', error);
                        fetchWeatherData(latitude, longitude, 'Your Location');
                    });
            },
            error => {
                hideLoading();
                console.error('Geolocation error:', error);
                // Fallback to default city if geolocation fails
                fetchWeatherData(52.52, 13.41, 'Berlin, Germany');
            }
        );
    } else {
        // Fallback to default city if geolocation not supported
        fetchWeatherData(52.52, 13.41, 'Berlin, Germany');
    }
}

// Initialize Leaflet map
function initMap() {
    map = L.map('weather-map', {
        zoomControl: false,
        preferCanvas: true
    }).setView([51.505, -0.09], 3);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    // Add a "Back to Current Location" button on the map
    const locationBackControl = L.control({ position: 'topright' });
    locationBackControl.onAdd = function(map) {
        const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
        div.style.backgroundColor = 'white';
        div.style.width = '34px';
        div.style.height = '34px';
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.justifyContent = 'center';
        div.style.cursor = 'pointer';
        div.title = 'Back to Current Location';
        div.innerHTML = '<i class="fas fa-location-arrow"></i>';
        div.onclick = function(e) {
            e.stopPropagation();
            if (currentWeatherData) {
                const { lat, lon } = currentWeatherData.coord;
                map.setView([lat, lon], 10);
            }
        };
        return div;
    };
    locationBackControl.addTo(map);
    
    // Add weather layer control
    addWeatherLayer();
}

// Add weather layer to map
function addWeatherLayer() {
    // Temperature layer
    fetch(`https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${API_KEY}`)
        .then(response => {
            if (response.ok) {
                L.tileLayer(`https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${API_KEY}`, {
                    maxZoom: 10,
                    opacity: 0.7
                }).addTo(map);
            }
        })
        .catch(error => console.error('Error loading temperature layer:', error));
    
    // Precipitation layer
    fetch(`https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${API_KEY}`)
        .then(response => {
            if (response.ok) {
                L.tileLayer(`https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${API_KEY}`, {
                    maxZoom: 10,
                    opacity: 0.7
                }).addTo(map);
            }
        })
        .catch(error => console.error('Error loading precipitation layer:', error));
}

// Set current date
function setCurrentDate() {
    const now = new Date();
    const options = { month: 'long', weekday: 'short' };
    currentDate.textContent = `${now.toLocaleDateString('en-US', { month: 'long' })}, ${now.toLocaleDateString('en-US', { weekday: 'short' })}`;
}

// Handle city search input
function handleCitySearch() {
    const query = citySearch.value.trim();
    if (query.length < 3) {
        searchResults.style.display = 'none';
        return;
    }
    
    fetch(`${GEOCODING_URL}?q=${query}&limit=5&appid=${API_KEY}`)
        .then(response => response.json())
        .then(data => {
            if (data.length > 0) {
                displaySearchResults(data);
            } else {
                searchResults.style.display = 'none';
            }
        })
        .catch(error => {
            console.error('Error fetching city data:', error);
            searchResults.style.display = 'none';
        });
}

// Display search results
function displaySearchResults(cities) {
    searchResults.innerHTML = '';
    cities.forEach(city => {
        const resultItem = document.createElement('div');
        resultItem.className = 'search-result-item';
        resultItem.textContent = `${city.name}, ${city.country}`;
        resultItem.addEventListener('click', () => {
            fetchWeatherData(city.lat, city.lon, `${city.name}, ${city.country}`);
            searchResults.style.display = 'none';
            citySearch.value = `${city.name}, ${city.country}`;
        });
        searchResults.appendChild(resultItem);
    });
    searchResults.style.display = 'block';
}

// Handle geolocation button click
function handleGeolocation() {
    if (navigator.geolocation) {
        showLoading();
        navigator.geolocation.getCurrentPosition(
            position => {
                const { latitude, longitude } = position.coords;
                fetch(`https://api.openweathermap.org/geo/1.0/reverse?lat=${latitude}&lon=${longitude}&limit=1&appid=${API_KEY}`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.length > 0) {
                            const city = data[0];
                            fetchWeatherData(latitude, longitude, `${city.name}, ${city.country}`);
                        } else {
                            fetchWeatherData(latitude, longitude, 'Your Location');
                        }
                    })
                    .catch(error => {
                        console.error('Error fetching location name:', error);
                        fetchWeatherData(latitude, longitude, 'Your Location');
                    });
            },
            error => {
                hideLoading();
                alert('Unable to retrieve your location. Please enable location services or search for a city manually.');
                console.error('Geolocation error:', error);
            }
        );
    } else {
        alert('Geolocation is not supported by your browser. Please search for a city manually.');
    }
}

// Handle temperature unit change
function handleUnitChange(button) {
    if (button.dataset.unit === currentUnit) return;

    currentUnit = button.dataset.unit;
    tempUnitButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.unit === currentUnit));

    // Update all temperature displays
    if (currentWeatherData) {
        updateCurrentWeather(currentWeatherData);
    }

    if (hourlyForecastData) {
        updateHourlyForecast(hourlyForecastData);
    }

    if (daily8ForecastData) {
        updateDaily8Forecast();
    }

    if (popularCities.length > 0) {
        updatePopularCities();
    }
}

// Setup theme from localStorage or system preference
function setupTheme() {
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeIcon(savedTheme);
    } else if (systemPrefersDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
        updateThemeIcon('dark');
    }
    
    // Check time for auto theme (6PM to 6AM)
    checkAutoTheme();
    
    // Update map theme
    updateMapTheme();
}

// Toggle between light and dark theme
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
    
    // Update map theme
    updateMapTheme();
}

// Update theme toggle icon
function updateThemeIcon(theme) {
    const icon = themeToggle.querySelector('i');
    icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

// Check time for auto theme switching (6PM to 6AM)
function checkAutoTheme() {
    if (localStorage.getItem('theme')) return; // Skip if user has set preference
    
    const hours = new Date().getHours();
    const isNightTime = hours >= 18 || hours < 6;
    
    if (isNightTime && !document.documentElement.getAttribute('data-theme')) {
        document.documentElement.setAttribute('data-theme', 'dark');
        updateThemeIcon('dark');
        updateMapTheme();
    }
}

// Update map theme based on current theme
function updateMapTheme() {
    if (!map) return;
    
    // Remove existing tiles
    map.eachLayer(layer => {
        if (layer._url && layer._url.includes('openstreetmap.org')) {
            map.removeLayer(layer);
        }
    });
    
    // Add tiles with updated theme
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    // Re-add weather layers
    addWeatherLayer();
}

// Fetch weather data for a location
function fetchWeatherData(lat, lon, locationName) {
    showLoading();
    currentCity.textContent = locationName;
    clearMarkers();
    addMarker(lat, lon, locationName);
    map.setView([lat, lon], 10);
    updateWeatherBackgroundForLocation(lat, lon);

    // Fetch current weather
    fetch(`${BASE_URL}/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`)
        .then(response => response.json())
        .then(data => {
            currentWeatherData = data;
            updateCurrentWeather(data);

            // Fetch UV index (needs separate call)
            fetch(`${BASE_URL}/uvi?lat=${lat}&lon=${lon}&appid=${API_KEY}`)
                .then(response => response.json())
                .then(uvData => {
                    updateUVIndex(uvData.value);
                })
                .catch(error => console.error('Error fetching UV index:', error));

            // Fetch air quality (needs separate call)
            fetch(`${BASE_URL}/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`)
                .then(response => response.json())
                .then(aqiData => {
                    airQualityData = aqiData;
                    updateAirQuality(aqiData.list[0].main.aqi);
                })
                .catch(error => console.error('Error fetching air quality:', error));

            // Fetch hourly forecast (5 day / 3 hour forecast)
            return fetch(`${BASE_URL}/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`);
        })
        .then(response => response.json())
        .then(data => {
            hourlyForecastData = data;
            updateHourlyForecast(data);

            // Try 8-day forecast from One Call API
            return fetch(`https://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lon}&exclude=minutely,hourly,alerts&appid=${API_KEY}&units=metric`)
                .then(response => response.json())
                .then(oneCallData => {
                    if (oneCallData.daily && oneCallData.daily.length >= 8) {
                        daily8ForecastData = oneCallData.daily.slice(0, 8);
                        // Adapt for updateDaily8Forecast
                        daily8ForecastData = daily8ForecastData.map(day => ({
                            ...day,
                            weatherId: day.weather[0].id,
                            dayName: new Date(day.dt * 1000).toLocaleDateString('en-US', { weekday: 'short' })
                        }));
                        updateDaily8Forecast();
                    } else {
                        // Fallback to process 3-hourly forecast
                        processDaily8Forecast(data);
                    }
                });
        })
        .then(() => {
            // Mock historical data for demo
            setTimeout(() => {
                historicalData = {
                    current: {
                        temp: Math.round(currentWeatherData.main.temp - 3)
                    }
                };
                updateHistoricalComparison();
            }, 500);

            hideLoading();
        })
        .catch(error => {
            console.error('Error fetching weather data:', error);
            hideLoading();
            alert('Failed to fetch weather data. Please try again later.');
        });

    updatePopularCities();
}

// Process and update 8-day forecast using 3-hourly forecast data (fallback if One Call API is not available)
function processDaily8Forecast(data) {
    const dailyForecasts = {};

    data.list.forEach(forecast => {
        const date = new Date(forecast.dt * 1000);
        const dayKey = date.toISOString().split('T')[0]; // e.g., "2025-08-10"
        if (!dailyForecasts[dayKey]) {
            dailyForecasts[dayKey] = [];
        }
        dailyForecasts[dayKey].push(forecast);
    });

    const sortedDays = Object.keys(dailyForecasts).sort();

    // Take the next 8 days
    daily8ForecastData = sortedDays.slice(0, 8).map(dayKey => {
        const dayForecasts = dailyForecasts[dayKey];
        const dayDate = new Date(dayForecasts[0].dt * 1000);

        const avgTemp = dayForecasts.reduce((sum, f) => sum + f.main.temp, 0) / dayForecasts.length;

        const weatherCounts = {};
        dayForecasts.forEach(f => {
            const weatherId = f.weather[0].id;
            weatherCounts[weatherId] = (weatherCounts[weatherId] || 0) + 1;
        });
        const mostCommonWeather = Object.entries(weatherCounts).reduce((a, b) => a[1] > b[1] ? a : b)[0];

        return {
            date: dayDate,
            dayName: dayDate.toLocaleDateString('en-US', { weekday: 'short' }),
            temp: avgTemp,
            weatherId: mostCommonWeather
        };
    });

    updateDaily8Forecast();
}

// Update daily 8-day forecast display
function updateDaily8Forecast() {
    if (!daily8ForecastData) return;
    dailyScroll.innerHTML = '';
    daily8ForecastData.forEach((day, index) => {
        // Support both One Call and fallback structure
        const temp = currentUnit === 'c'
            ? Math.round(day.temp.day !== undefined ? day.temp.day : day.temp)
            : Math.round(((day.temp.day !== undefined ? day.temp.day : day.temp) * 9/5) + 32);
        const icon = getWeatherIcon(day.weatherId !== undefined ? day.weatherId : day.weather[0].id, 12);
        const dayName = day.dayName || new Date(day.dt * 1000).toLocaleDateString('en-US', { weekday: 'short' });

        const dayElement = document.createElement('div');
        dayElement.className = 'daily-item';
        dayElement.innerHTML = `
            <p>${dayName}</p>
            <i class="fas ${icon}"></i>
            <p>${temp}°</p>
        `;
        // Add animation
        dayElement.style.opacity = '0';
        dayElement.style.transform = 'translateY(20px)';
        setTimeout(() => {
            dayElement.classList.add('fade-in');
            dayElement.style.opacity = '1';
            dayElement.style.transform = 'translateY(0)';
        }, index * 100);

        dailyScroll.appendChild(dayElement);
    });
}

// Update current weather display
function updateCurrentWeather(data) {
    const temp = currentUnit === 'c' ? Math.round(data.main.temp) : Math.round((data.main.temp * 9/5) + 32);
    currentTemp.textContent = temp;
    
    weatherIcon.src = `${ICON_URL}${data.weather[0].icon}@2x.png`;
    weatherIcon.alt = data.weather[0].description;
    weatherDescription.textContent = data.weather[0].description;
    
    humidity.textContent = `${data.main.humidity}%`;
    windSpeed.textContent = `${Math.round(data.wind.speed * 3.6)} km/h`;
    pressure.textContent = `${data.main.pressure} hPa`;
    visibility.textContent = `${(data.visibility / 1000).toFixed(1)} km`;
    
    // Update sunrise/sunset times
    const sunrise = new Date(data.sys.sunrise * 1000);
    const sunset = new Date(data.sys.sunset * 1000);
    sunriseTime.textContent = sunrise.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    sunsetTime.textContent = sunset.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Check for rainfall data
    if (data.rain && data.rain['1h']) {
        rainfall.textContent = `${data.rain['1h']}mm`;
    } else if (data.rain && data.rain['3h']) {
        rainfall.textContent = `${data.rain['3h']}mm`;
    } else {
        rainfall.textContent = '0mm';
    }
    
    // Add animation to weather icon
    weatherIcon.classList.add('weather-icon-animation');
    
    // Update weather background based on current weather
    updateWeatherBackground(data.weather[0].id);
}

// Update UV index display
function updateUVIndex(uvValue) {
    uvIndex.textContent = uvValue.toFixed(1);
    
    // Position the UV indicator
    let position = 0;
    if (uvValue <= 2) {
        position = (uvValue / 2) * 20;
        uvAdvice.textContent = 'Low risk of harm from unprotected sun exposure.';
    } else if (uvValue <= 5) {
        position = 20 + ((uvValue - 2) / 3) * 20;
        uvAdvice.textContent = 'Moderate risk of harm from unprotected sun exposure.';
    } else if (uvValue <= 7) {
        position = 40 + ((uvValue - 5) / 2) * 20;
        uvAdvice.textContent = 'High risk of harm from unprotected sun exposure. Protection needed.';
    } else if (uvValue <= 10) {
        position = 60 + ((uvValue - 7) / 3) * 20;
        uvAdvice.textContent = 'Very high risk of harm from unprotected sun exposure. Extra protection needed.';
    } else {
        position = 80 + ((uvValue - 10) / 5) * 20;
        uvAdvice.textContent = 'Extreme risk of harm from unprotected sun exposure. Avoid sun exposure.';
    }
    
    uvIndicator.style.left = `${Math.min(position, 100)}%`;
}

// Update air quality display
function updateAirQuality(aqi) {
    const aqiText = ['Good', 'Fair', 'Moderate', 'Poor', 'Very Poor', 'Hazardous'];
    aqiValue.textContent = `AQI: ${aqi} (${aqiText[aqi - 1]})`;
    
    // Position the AQI indicator
    const position = ((aqi - 1) / 5) * 100;
    aqiIndicator.style.left = `${position}%`;
    
    // Set advice based on AQI
    const advice = [
        'Air quality is satisfactory, and air pollution poses little or no risk.',
        'Air quality is acceptable. However, there may be a risk for some people, particularly those who are unusually sensitive to air pollution.',
        'Members of sensitive groups may experience health effects. The general public is less likely to be affected.',
        'Some members of the general public may experience health effects; members of sensitive groups may experience more serious health effects.',
        'Health alert: The risk of health effects is increased for everyone.',
        'Health warning of emergency conditions: everyone is more likely to be affected.'
    ];
    
    aqiAdvice.textContent = advice[aqi - 1];
}

// Update hourly forecast display
function updateHourlyForecast(data) {
    hourlyScroll.innerHTML = '';
    
    // Get current hour
    const now = new Date();
    const currentHour = now.getHours();
    
    // Display next 12 hours
    for (let i = 0; i < 12; i++) {
        const forecast = data.list[i];
        const forecastDate = new Date(forecast.dt * 1000);
        const hour = forecastDate.getHours();
        const temp = currentUnit === 'c' ? Math.round(forecast.main.temp) : Math.round((forecast.main.temp * 9/5) + 32);
        
        const hourItem = document.createElement('div');
        hourItem.className = 'hourly-item';
        
        // Format time display
        let timeDisplay;
        if (i === 0) {
            timeDisplay = 'Now';
        } else {
            timeDisplay = `${hour}:00`;
        }
        
        hourItem.innerHTML = `
            <p>${timeDisplay}</p>
            <i class="fas ${getWeatherIcon(forecast.weather[0].id, hour)}"></i>
            <p>${temp}°</p>
        `;
        
        // Add animation
        hourItem.style.opacity = '0';
        hourItem.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            hourItem.classList.add('fade-in');
            hourItem.style.opacity = '1';
            hourItem.style.transform = 'translateY(0)';
        }, i * 100);
        
        hourlyScroll.appendChild(hourItem);
    }
}

// Update daily 8-day forecast display
function updateDaily8Forecast() {
    if (!daily8ForecastData) return;
    dailyScroll.innerHTML = '';
    daily8ForecastData.forEach((day, index) => {
        // Support both One Call and fallback structure
        const temp = currentUnit === 'c'
            ? Math.round(day.temp.day !== undefined ? day.temp.day : day.temp)
            : Math.round(((day.temp.day !== undefined ? day.temp.day : day.temp) * 9/5) + 32);
        const icon = getWeatherIcon(day.weatherId !== undefined ? day.weatherId : day.weather[0].id, 12);
        const dayName = day.dayName || new Date(day.dt * 1000).toLocaleDateString('en-US', { weekday: 'short' });

        const dayElement = document.createElement('div');
        dayElement.className = 'daily-item';
        dayElement.innerHTML = `
            <p>${dayName}</p>
            <i class="fas ${icon}"></i>
            <p>${temp}°</p>
        `;
        // Add animation
        dayElement.style.opacity = '0';
        dayElement.style.transform = 'translateY(20px)';
        setTimeout(() => {
            dayElement.classList.add('fade-in');
            dayElement.style.opacity = '1';
            dayElement.style.transform = 'translateY(0)';
        }, index * 100);

        dailyScroll.appendChild(dayElement);
    });
}

// Update historical comparison
function updateHistoricalComparison() {
    if (!currentWeatherData || !historicalData) return;
    
    const currentTemp = currentWeatherData.main.temp;
    const yesterdayTemp = historicalData.current.temp;
    
    const currentHeight = Math.min(Math.max((currentTemp + 20) / 40 * 100, 10), 100);
    const yesterdayHeight = Math.min(Math.max((yesterdayTemp + 20) / 40 * 100, 10), 100);
    
    todayBar.style.height = `${currentHeight}%`;
    todayBar.querySelector('span').innerHTML = `Today<br>${Math.round(currentTemp)}°`;
    
    yesterdayBar.style.height = `${yesterdayHeight}%`;
    yesterdayBar.querySelector('span').innerHTML = `Yesterday<br>${Math.round(yesterdayTemp)}°`;
    
    const diff = Math.round(currentTemp - yesterdayTemp);
    const comparisonText = document.querySelector('.historical-comparison p');
    
    if (diff > 0) {
        comparisonText.textContent = `Warmer than yesterday by ${diff}°`;
    } else if (diff < 0) {
        comparisonText.textContent = `Cooler than yesterday by ${Math.abs(diff)}°`;
    } else {
        comparisonText.textContent = `Same temperature as yesterday`;
    }
}

// Update popular cities display
function updatePopularCities() {
    cityList.innerHTML = '';
    
    // Add current location to popular cities if not already there
    if (currentWeatherData) {
        const currentLocation = {
            name: currentCity.textContent,
            lat: currentWeatherData.coord.lat,
            lon: currentWeatherData.coord.lon
        };
        
        if (!popularCities.some(city => city.name === currentLocation.name)) {
            popularCities.unshift(currentLocation);
            
            // Keep only 3 popular cities
            if (popularCities.length > 3) {
                popularCities.pop();
            }
        }
    }
    
    // Fetch weather for each popular city
    popularCities.forEach(city => {
        fetch(`${BASE_URL}/weather?lat=${city.lat}&lon=${city.lon}&appid=${API_KEY}&units=metric`)
            .then(response => response.json())
            .then(data => {
                const temp = currentUnit === 'c' ? Math.round(data.main.temp) : Math.round((data.main.temp * 9/5) + 32);
                
                const cityElement = document.createElement('div');
                cityElement.className = 'city-item';
                cityElement.innerHTML = `
                    <p>${city.name}</p>
                    <p>${temp}°</p>
                `;
                
                cityElement.addEventListener('click', () => {
                    fetchWeatherData(city.lat, city.lon, city.name);
                });
                
                cityList.appendChild(cityElement);
            })
            .catch(error => console.error('Error fetching popular city weather:', error));
    });
}

// Add marker to map
function addMarker(lat, lon, title) {
    const marker = L.marker([lat, lon], {
        title: title,
        alt: title,
        riseOnHover: true
    }).addTo(map);
    
    marker.bindPopup(`<b>${title}</b><br>Loading weather data...`);
    
    // Fetch weather for marker popup
    fetch(`${BASE_URL}/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`)
        .then(response => response.json())
        .then(data => {
            const temp = currentUnit === 'c' ? Math.round(data.main.temp) : Math.round((data.main.temp * 9/5) + 32);
            marker.setPopupContent(`
                <b>${title}</b><br>
                ${temp}° | ${data.weather[0].description}<br>
                Humidity: ${data.main.humidity}%
            `);
        })
        .catch(error => console.error('Error fetching marker weather:', error));
    
    markers.push(marker);
}

// Clear all markers from map
function clearMarkers() {
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
}

// Get Font Awesome icon based on weather code and hour
function getWeatherIcon(weatherCode, hour) {
    const isDayTime = hour >= 6 && hour < 18;
    
    // Thunderstorm
    if (weatherCode >= 200 && weatherCode < 300) {
        return 'fa-bolt';
    }
    // Drizzle
    else if (weatherCode >= 300 && weatherCode < 400) {
        return 'fa-cloud-rain';
    }
    // Rain
    else if (weatherCode >= 500 && weatherCode < 600) {
        if (weatherCode < 502) return 'fa-cloud-rain';
        return 'fa-cloud-showers-heavy';
    }
    // Snow
    else if (weatherCode >= 600 && weatherCode < 700) {
        return 'fa-snowflake';
    }
    // Atmosphere (fog, mist, etc.)
    else if (weatherCode >= 700 && weatherCode < 800) {
        return 'fa-smog';
    }
    // Clear
    else if (weatherCode === 800) {
        return isDayTime ? 'fa-sun' : 'fa-moon';
    }
    // Clouds
    else if (weatherCode > 800 && weatherCode < 900) {
        if (weatherCode === 801) return isDayTime ? 'fa-cloud-sun' : 'fa-cloud-moon';
        return 'fa-cloud';
    }
    // Extreme or additional conditions
    else {
        return 'fa-question';
    }
}

// Create dynamic weather background
function createWeatherBackground() {
    weatherBackground.innerHTML = '';
}

// Update weather background based on current weather
function updateWeatherBackground(weatherCode) {
    weatherBackground.innerHTML = '';
    
    // Clear weather
    if (weatherCode === 800) {
        createSunBackground();
    }
    // Cloudy weather
    else if (weatherCode > 800 && weatherCode < 900) {
        createCloudBackground();
    }
    // Rainy weather
    else if (weatherCode >= 500 && weatherCode < 600) {
        createRainBackground();
    }
    // Snowy weather
    else if (weatherCode >= 600 && weatherCode < 700) {
        createSnowBackground();
    }
    // Thunderstorm
    else if (weatherCode >= 200 && weatherCode < 300) {
        createThunderstormBackground();
    }
}

// Update weather background based on location (for initial load)
function updateWeatherBackgroundForLocation(lat, lon) {
    fetch(`${BASE_URL}/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`)
        .then(response => response.json())
        .then(data => {
            updateWeatherBackground(data.weather[0].id);
        })
        .catch(error => console.error('Error fetching weather for background:', error));
}

// Create sun background elements
function createSunBackground() {
    const sun = document.createElement('div');
    sun.className = 'weather-bg-element sun';
    sun.style.width = '180px';
    sun.style.height = '180px';
    sun.style.background = 'radial-gradient(circle, #ffde59 0%, #ff914d 100%)';
    sun.style.top = '10%';
    sun.style.right = '10%';
    weatherBackground.appendChild(sun);
}

function createCloudBackground() {
    for (let i = 0; i < 3; i++) {
        const cloud = document.createElement('div');
        cloud.className = 'weather-bg-element cloud';
        cloud.style.background = 'rgba(255,255,255,0.8)';
        cloud.style.width = `${120 + Math.random() * 80}px`;
        cloud.style.height = `${50 + Math.random() * 30}px`;
        cloud.style.top = `${20 + i * 20 + Math.random() * 10}%`;
        cloud.style.left = `${-20 + Math.random() * 30}%`;
        cloud.style.animationDuration = `${30 + Math.random() * 20}s`;
        weatherBackground.appendChild(cloud);
    }
}

function createRainBackground() {
    createCloudBackground();
    for (let i = 0; i < 40; i++) {
        const rain = document.createElement('div');
        rain.className = 'weather-bg-element rain';
        rain.style.background = 'linear-gradient(to bottom, transparent, rgba(76,201,240,0.7))';
        rain.style.width = '2px';
        rain.style.height = `${12 + Math.random() * 10}px`;
        rain.style.left = `${Math.random() * 100}%`;
        rain.style.top = `${-10 - Math.random() * 10}%`;
        rain.style.animationDuration = `${1 + Math.random()}s`;
        rain.style.animationDelay = `${Math.random() * 2}s`;
        weatherBackground.appendChild(rain);
    }
}

function createSnowBackground() {
    createCloudBackground();
    for (let i = 0; i < 25; i++) {
        const snow = document.createElement('div');
        snow.className = 'weather-bg-element snow';
        snow.style.background = 'white';
        snow.style.width = `${4 + Math.random() * 4}px`;
        snow.style.height = snow.style.width;
        snow.style.left = `${Math.random() * 100}%`;
        snow.style.top = `${-10 - Math.random() * 10}%`;
        snow.style.animationDuration = `${4 + Math.random() * 4}s`;
        snow.style.animationDelay = `${Math.random() * 3}s`;
        weatherBackground.appendChild(snow);
    }
}

// Create thunderstorm background elements
function createThunderstormBackground() {
    createRainBackground();
    
    // Add occasional lightning flashes
    const lightning = document.createElement('div');
    lightning.className = 'weather-bg-element lightning';
    lightning.style.position = 'fixed';
    lightning.style.top = '0';
    lightning.style.left = '0';
    lightning.style.width = '100%';
    lightning.style.height = '100%';
    lightning.style.backgroundColor = 'rgba(255, 255, 255, 0)';
    lightning.style.pointerEvents = 'none';
    lightning.style.zIndex = '1';
    lightning.style.transition = 'background-color 0.1s ease';
    weatherBackground.appendChild(lightning);
    
    setInterval(() => {
        if (Math.random() > 0.7) {
            lightning.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
            setTimeout(() => {
                lightning.style.backgroundColor = 'rgba(255, 255, 255, 0)';
            }, 100);
        }
    }, 3000);
}

// Show loading overlay
function showLoading() {
    loadingOverlay.classList.add('active');
    
    // Random loading messages
    const messages = [
        'Fetching weather data...',
        'Checking satellite imagery...',
        'Analyzing atmospheric conditions...',
        'Consulting weather models...',
        'Calculating forecasts...',
        'Updating weather information...',
        'Gathering meteorological data...'
    ];
    
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    document.querySelector('.loading-text').textContent = randomMessage;
    
    // Show appropriate loader based on current weather
    const loaderSun = document.querySelector('.loader-sun');
    const loaderRain = document.querySelector('.loader-rain');
    
    if (currentWeatherData) {
        const weatherCode = currentWeatherData.weather[0].id;
        
        // Clear weather
        if (weatherCode === 800) {
            loaderSun.style.opacity = '1';
            loaderRain.style.opacity = '0';
        }
        // Rainy weather
        else if (weatherCode >= 500 && weatherCode < 600) {
            loaderSun.style.opacity = '0';
            loaderRain.style.opacity = '1';
        }
        // Default (cloudy)
        else {
            loaderSun.style.opacity = '0';
            loaderRain.style.opacity = '0';
        }
    } else {
        // Default loader (cloud only)
        loaderSun.style.opacity = '0';
        loaderRain.style.opacity = '0';
    }
}

// Hide loading overlay
function hideLoading() {
    loadingOverlay.classList.remove('active');
}

// Debounce function for search input
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);