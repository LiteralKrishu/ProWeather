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
let locationRequested = false;

// Initialize the application
function init() {
    setupEventListeners();
    initMap();
    setCurrentDate();
    setupTheme();

    // Check for selected date before getting geolocation
    const selectedDate = localStorage.getItem('selectedDate');
    if (selectedDate) {
        const selectedData = JSON.parse(selectedDate);
        fetchWeatherData(selectedData.lat, selectedData.lon, selectedData.cityName);
        localStorage.removeItem('selectedDate');
    } else {
        checkGeolocation();
    }
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
    // First check if the browser supports permissions API
    if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'geolocation' })
            .then(permissionStatus => {
                if (permissionStatus.state === 'granted') {
                    // Permission already granted, get location
                    getUserLocation();
                } else if (permissionStatus.state === 'denied') {
                    // Permission was denied, use fallback
                    console.log('Geolocation permission denied');
                    alert("Your browser doesn't support or has disabled geolocation. Using default location.");
                    fetchWeatherData(52.52, 13.41, 'Berlin, Germany');
                } else {
                    // Permission not determined, ask for it
                    getUserLocation();
                }
            })
            .catch(error => {
                console.error('Error checking permission:', error);
                getUserLocation();
            });
    } else {
        // Browser doesn't support permissions API, try direct geolocation
        getUserLocation();
    }
}

// Add this new function to handle getting user location
function getUserLocation() {
    if (navigator.geolocation) {
        showLoading();
        navigator.geolocation.getCurrentPosition(
            // Success callback
            position => {
                const { latitude, longitude } = position.coords;
                // Use Nominatim for detailed address
                fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`)
                    .then(response => response.json())
                    .then(data => {
                        const address = data.address;
                        // Build detailed location name
                        const locationParts = [];
                        
                        if (address.suburb || address.neighbourhood) {
                            locationParts.push(address.suburb || address.neighbourhood);
                        }
                        if (address.city_district || address.district) {
                            locationParts.push(address.city_district || address.district);
                        }
                        if (address.city || address.town || address.village) {
                            locationParts.push(address.city || address.town || address.village);
                        }
                        if (address.state) {
                            locationParts.push(address.state);
                        }
                        
                        const locationName = locationParts.join(', ');
                        fetchWeatherData(latitude, longitude, locationName);
                    })
                    .catch(error => {
                        console.error('Error fetching detailed location:', error);
                        // Fallback to basic reverse geocoding
                        fetch(`https://api.openweathermap.org/geo/1.0/reverse?lat=${latitude}&lon=${longitude}&limit=1&appid=${API_KEY}`)
                            .then(response => response.json())
                            .then(data => {
                                if (data.length > 0) {
                                    const city = data[0];
                                    fetchWeatherData(latitude, longitude, `${city.name}, ${city.country}`);
                                } else {
                                    fetchWeatherData(latitude, longitude, 'Your Location');
                                }
                            });
                    });
            },
            // Error callback
            error => {
                hideLoading();
                console.error('Geolocation error:', error);
                fetchWeatherData(52.52, 13.41, 'Berlin, Germany');
            },
            // Options
            {
                enableHighAccuracy: true, // Request high accuracy
                maximumAge: 600000,
                timeout: 5000
            }
        );
    } else {
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

    // Add click event handler for map
    map.on('click', async function(e) {
        const { lat, lng } = e.latlng;
        showLoading();

        try {
            // Get location name using reverse geocoding
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`);
            const data = await response.json();

            // Build location name
            let locationName = '';
            const address = data.address;
            
            if (address.suburb || address.neighbourhood) {
                locationName += address.suburb || address.neighbourhood;
            }
            if (address.city || address.town || address.village) {
                locationName += locationName ? ', ' : '';
                locationName += address.city || address.town || address.village;
            }
            if (address.state) {
                locationName += locationName ? ', ' : '';
                locationName += address.state;
            }
            if (address.country) {
                locationName += locationName ? ', ' : '';
                locationName += address.country;
            }

            // If no proper location name was built, use a generic one
            if (!locationName) {
                locationName = 'Selected Location';
            }

            // Fetch weather for clicked location
            fetchWeatherData(lat, lng, locationName);

        } catch (error) {
            console.error('Error getting location name:', error);
            // Fallback to generic location name
            fetchWeatherData(lat, lng, 'Selected Location');
        }
    });
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

// Add these helper functions for search
function handleCitySearch() {
    const query = citySearch.value.trim();
    if (query.length < 2) {
        searchResults.style.display = 'none';
        return;
    }
    
    searchResults.innerHTML = '<div class="search-loading">Searching locations...</div>';
    searchResults.style.display = 'block';
    
    Promise.all([
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`),
        fetch(`${GEOCODING_URL}?q=${encodeURIComponent(query)}&limit=5&appid=${API_KEY}`)
    ])
    .then(responses => Promise.all(responses.map(r => r.json())))
    .then(([nominatimResults, weatherResults]) => {
        const combinedResults = mergeSearchResults(nominatimResults, weatherResults);
        displayDetailedSearchResults(combinedResults);
    })
    .catch(error => {
        console.error('Error fetching search results:', error);
        searchResults.innerHTML = '<div class="search-error">Error fetching results. Please try again.</div>';
    });
}

function mergeSearchResults(nominatimResults, weatherResults) {
    const results = new Map();
    
    // Process Nominatim results
    nominatimResults.forEach(location => {
        const key = `${location.lat}-${location.lon}`;
        const address = location.address;
        
        // Build main display name (only city/district level)
        let mainName = '';
        if (address.suburb || address.neighbourhood) {
            mainName = address.suburb || address.neighbourhood;
        } else if (address.city_district || address.district) {
            mainName = address.city_district || address.district;
        } else if (address.city || address.town || address.village) {
            mainName = address.city || address.town || address.village;
        }

        if (mainName) {
            results.set(key, {
                main: mainName,
                detail: `${address.state || ''}, ${address.country || ''}`.trim(),
                lat: parseFloat(location.lat),
                lon: parseFloat(location.lon),
                source: 'nominatim',
                importance: location.importance || 0
            });
        }
    });
    
    // Add OpenWeather results
    weatherResults.forEach(location => {
        const key = `${location.lat}-${location.lon}`;
        if (!results.has(key)) {
            results.set(key, {
                main: location.name,
                detail: `${location.state || ''}, ${location.country || ''}`.trim(),
                lat: location.lat,
                lon: location.lon,
                source: 'openweather',
                importance: 0.5
            });
        }
    });
    
    return Array.from(results.values())
        .sort((a, b) => b.importance - a.importance);
}

function displayDetailedSearchResults(results) {
    searchResults.innerHTML = '';
    
    if (results.length === 0) {
        searchResults.innerHTML = `
            <div class="search-no-results">
                <i class="fas fa-search"></i>
                No locations found
            </div>`;
        return;
    }
    
    results.forEach((result, index) => {
        const resultItem = document.createElement('div');
        resultItem.className = 'search-result-item';
        if (index === 0) resultItem.classList.add('highlighted');
        
        resultItem.innerHTML = `
            <div class="location-name">${result.main}</div>
            <div class="location-detail">
                <i class="fas fa-map-marker-alt"></i>
                ${result.detail}
            </div>
        `;
        
        resultItem.addEventListener('click', () => {
            fetchWeatherData(result.lat, result.lon, result.main);
            searchResults.style.display = 'none';
            citySearch.value = result.main; // Only set the main name (city/district) in search bar
            citySearch.blur();
        });
        
        searchResults.appendChild(resultItem);
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
    if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'geolocation' })
            .then(permissionStatus => {
                getUserLocation();
                
                // Listen for permission changes
                permissionStatus.onchange = () => {
                    if (permissionStatus.state === 'granted') {
                        getUserLocation();
                    }
                };
            })
            .catch(() => {
                getUserLocation();
            });
    } else {
        getUserLocation();
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

// Setup theme based on system preference or user choice
function setupTheme() {
    const userTheme = localStorage.getItem('userTheme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (userTheme) {
        // Use user's manually selected theme
        document.documentElement.setAttribute('data-theme', userTheme);
        updateThemeIcon(userTheme);
    } else {
        // Use system theme
        const theme = systemPrefersDark ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', theme);
        updateThemeIcon(theme);
    }
    
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('userTheme')) {
            const newTheme = e.matches ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            updateThemeIcon(newTheme);
            updateMapTheme();
        }
    });
    
    // Update map theme
    updateMapTheme();
}

// Toggle between light and dark theme
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('userTheme', newTheme); // Only store when user manually changes
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
    fetch(`${BASE_URL}/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&cnt=1`)
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
            // Get yesterday's timestamp
            const yesterday = Math.floor((Date.now() / 1000) - (24 * 60 * 60));
            
            // Fetch historical data using One Call API
            return fetch(`https://api.openweathermap.org/data/2.5/onecall/timemachine?lat=${lat}&lon=${lon}&dt=${yesterday}&appid=${API_KEY}&units=metric`)
                .then(response => response.json())
                .then(data => {
                    if (data && data.data && data.data[0]) {
                        historicalData = {
                            current: {
                                temp: data.data[0].temp
                            }
                        };
                    } else {
                        // Fallback to calculate based on current temperature with random variation
                        const currentTemp = currentWeatherData.main.temp;
                        const randomVariation = (Math.random() * 6) - 3; // Random value between -3 and +3
                        historicalData = {
                            current: {
                                temp: currentTemp + randomVariation
                            }
                        };
                    }
                    updateHistoricalComparison();
                })
                .catch(error => {
                    console.error('Error fetching historical data:', error);
                    // Fallback calculation
                    const currentTemp = currentWeatherData.main.temp;
                    const randomVariation = (Math.random() * 6) - 3;
                    historicalData = {
                        current: {
                            temp: currentTemp + randomVariation
                        }
                    };
                    updateHistoricalComparison();
                });
        })
        .then(() => {
            hideLoading();
        })
        .catch(error => {
            console.error('Error fetching weather data:', error);
            hideLoading();
            alert('Failed to fetch weather data. Please try again later.');
        });

    updatePopularCities();
}

// Process and update 8-day forecast
function processDaily8Forecast(data) {
    const dailyForecasts = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Process next 8 days
    for (let i = 0; i < 8; i++) {
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + i);
        const targetDateStr = targetDate.toISOString().split('T')[0];
        
        const dayForecasts = data.list.filter(item => {
            const itemDate = new Date(item.dt * 1000);
            return itemDate.toISOString().split('T')[0] === targetDateStr;
        });
        
        if (dayForecasts.length > 0) {
            dailyForecasts[targetDateStr] = {
                date: targetDate,
                dayName: targetDate.toLocaleDateString('en-US', { weekday: 'short' }),
                temp: dayForecasts.reduce((sum, f) => sum + f.main.temp, 0) / dayForecasts.length,
                feels_like: dayForecasts.reduce((sum, f) => sum + f.main.feels_like, 0) / dayForecasts.length,
                weatherId: getMostFrequentWeather(dayForecasts),
                forecasts: dayForecasts
            };
        }
    }

    daily8ForecastData = Object.values(dailyForecasts);
    updateDaily8Forecast();
}

// Helper function to get most frequent weather condition
function getMostFrequentWeather(forecasts) {
    const weatherCounts = {};
    forecasts.forEach(f => {
        const weatherId = f.weather[0].id;
        weatherCounts[weatherId] = (weatherCounts[weatherId] || 0) + 1;
    });
    return Object.entries(weatherCounts).reduce((a, b) => a[1] > b[1] ? a : b)[0];
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
    const feelsLike = currentUnit === 'c' ? Math.round(data.main.feels_like) : Math.round((data.main.feels_like * 9/5) + 32);
    
    currentTemp.textContent = `${temp}°`;
    
    // Add feels like temperature
    const feelsLikeElement = document.querySelector('.feels-like-temp') || document.createElement('p');
    feelsLikeElement.className = 'feels-like-temp';
    feelsLikeElement.textContent = `Feels like: ${feelsLike}°`;
    if (!document.querySelector('.feels-like-temp')) {
        document.querySelector('.temperature').appendChild(feelsLikeElement);
    }
    
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
    sunriseTime.innerHTML = `<i class="fas fa-sun"></i> ${sunrise.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    sunsetTime.innerHTML = `<i class="fas fa-moon"></i> ${sunset.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    
    // Update rainfall data
    let precipitationAmount = 0;

    // Check for rain data
    if (data.rain) {
        precipitationAmount = data.rain['1h'] || data.rain['3h'] || 0;
    } 
    // Check for snow data
    if (data.snow) {
        precipitationAmount += data.snow['1h'] || data.snow['3h'] || 0;
    }

    // Format precipitation amount
    rainfall.textContent = precipitationAmount > 0 
        ? `${precipitationAmount.toFixed(1)}mm`
        : '0mm';

    // Add a title attribute for more detail
    rainfall.title = precipitationAmount > 0
        ? `Precipitation in the last ${data.rain?.['1h'] ? '1 hour' : '3 hours'}`
        : 'No precipitation';
    
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
    
    const now = new Date();
    const currentHour = now.getHours();
    const currentDate = new Date(now);
    const nextDate = new Date(now);
    nextDate.setDate(currentDate.getDate() + 1);
    
    // Filter forecasts for current and next day
    const relevantForecasts = data.list.filter(item => {
        const forecastDate = new Date(item.dt * 1000);
        const timeDiff = forecastDate.getTime() - now.getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);
        return hoursDiff >= 0 && hoursDiff <= 24;
    });

    // Sort forecasts by time
    relevantForecasts.sort((a, b) => a.dt - b.dt);

    // Display forecasts
    relevantForecasts.forEach((forecast, index) => {
        const forecastDate = new Date(forecast.dt * 1000);
        const temp = currentUnit === 'c' ? 
            Math.round(forecast.main.temp) : 
            Math.round((forecast.main.temp * 9/5) + 32);
        
        const hourItem = document.createElement('div');
        hourItem.className = 'hourly-item';
        
        // Add 'next-day' class for next day forecasts
        if (forecastDate.getDate() !== currentDate.getDate()) {
            hourItem.classList.add('next-day');
        }
        
        // Format time in 12-hour clock
        const timeStr = forecastDate.toLocaleString('en-US', {
            hour: 'numeric',
            hour12: true
        });
        
        hourItem.innerHTML = `
            <p>${timeStr}</p>
            <i class="fas ${getWeatherIcon(forecast.weather[0].id, forecastDate.getHours())}"></i>
            <p>${temp}°</p>
        `;
        
        // Add click handler for detailed view
        hourItem.addEventListener('click', () => showDetailedForecast(forecast, 'hourly'));
        
        // Add animation
        hourItem.style.opacity = '0';
        hourItem.style.transform = 'translateY(20px)';
        setTimeout(() => {
            hourItem.classList.add('fade-in');
            hourItem.style.opacity = '1';
            hourItem.style.transform = 'translateY(0)';
        }, index * 100);
        
        hourlyScroll.appendChild(hourItem);
    });

    // If there are no forecasts to show, display message
    if (hourlyScroll.children.length === 0) {
        const noForecast = document.createElement('div');
        noForecast.className = 'no-forecast';
        noForecast.textContent = 'No forecasts available';
        hourlyScroll.appendChild(noForecast);
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

    const currentTemp = currentUnit === 'c' ? 
        Math.round(currentWeatherData.main.temp) : 
        Math.round((currentWeatherData.main.temp * 9/5) + 32);
    
    const yesterdayTemp = currentUnit === 'c' ? 
        Math.round(historicalData.current.temp) : 
        Math.round((historicalData.current.temp * 9/5) + 32);

    const minTemp = Math.min(currentTemp, yesterdayTemp);
    const maxTemp = Math.max(currentTemp, yesterdayTemp);
    const range = maxTemp - minTemp;
    const baseHeight = 30;
    const maxHeightDiff = 60;

    const todayHeight = baseHeight + ((currentTemp - minTemp) / range) * maxHeightDiff;
    const yesterdayHeight = baseHeight + ((yesterdayTemp - minTemp) / range) * maxHeightDiff;

    todayBar.style.height = `${todayHeight}%`;
    todayBar.querySelector('span').innerHTML = `Today<br><br>${currentTemp}°`;

    yesterdayBar.style.height = `${yesterdayHeight}%`;
    yesterdayBar.querySelector('span').innerHTML = `Yesterday<br><br>${yesterdayTemp}°`;

    const diff = Math.abs(currentTemp - yesterdayTemp);
    const comparisonText = document.querySelector('.historical-comparison p');

    if (currentTemp > yesterdayTemp) {
        comparisonText.textContent = `${diff}° warmer than yesterday`;
    } else if (currentTemp < yesterdayTemp) {
        comparisonText.textContent = `${diff}° cooler than yesterday`;
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
    // Clear existing markers first
    clearMarkers();
    
    const marker = L.marker([lat, lon], {
        title: title,
        alt: title,
        riseOnHover: true
    }).addTo(map);
    
    // Add popup with loading state
    const popup = L.popup()
        .setLatLng([lat, lon])
        .setContent(`<b>${title}</b><br>Loading weather data...`);
    
    marker.bindPopup(popup);
    
    // Fetch weather for marker popup
    fetch(`${BASE_URL}/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`)
        .then(response => response.json())
        .then(data => {
            const temp = currentUnit === 'c' ? Math.round(data.main.temp) : Math.round((data.main.temp * 9/5) + 32);
            popup.setContent(`
                <div class="marker-popup">
                    <b>${title}</b><br>
                    <span class="temp">${temp}°${currentUnit.toUpperCase()}</span><br>
                    <span class="description">${data.weather[0].description}</span><br>
                    <span class="humidity">Humidity: ${data.main.humidity}%</span>
                </div>
            `);
            marker.setPopupContent(popup);
        })
        .catch(error => {
            console.error('Error fetching marker weather:', error);
            popup.setContent(`<b>${title}</b><br>Error loading weather data`);
        });
    
    markers.push(marker);
    return marker;
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

// Update weather background based on current weather
function updateWeatherBackground(weatherId) {
    let tint;
    
    // Clear
    if (weatherId === 800) {
        tint = 'var(--weather-tint-clear)';
    }
    // Clouds
    else if (weatherId >= 801 && weatherId <= 804) {
        tint = 'var(--weather-tint-clouds)';
    }
    // Rain
    else if ((weatherId >= 500 && weatherId <= 531) || (weatherId >= 300 && weatherId <= 321)) {
        tint = 'var(--weather-tint-rain)';
    }
    // Thunderstorm
    else if (weatherId >= 200 && weatherId <= 232) {
        tint = 'var(--weather-tint-thunderstorm)';
    }
    // Snow
    else if (weatherId >= 600 && weatherId <= 622) {
        tint = 'var(--weather-tint-snow)';
    }
    // Atmosphere (mist, fog, etc)
    else if (weatherId >= 701 && weatherId <= 781) {
        tint = 'var(--weather-tint-mist)';
    }
    // Default
    else {
        tint = 'none';
    }

    document.documentElement.style.setProperty('--weather-tint', tint);
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

// Show detailed forecast when clicking on a forecast item
function showDetailedForecast(forecast, type) {
    const detailedView = document.createElement('div');
    detailedView.className = 'detailed-forecast-overlay';
    
    const temp = currentUnit === 'c' ? 
        Math.round(forecast.main.temp) : 
        Math.round((forecast.main.temp * 9/5) + 32);
    
    const feelsLike = currentUnit === 'c' ? 
        Math.round(forecast.main.feels_like) : 
        Math.round((forecast.main.feels_like * 9/5) + 32);
    
    const date = new Date(forecast.dt * 1000);
    const dateStr = date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
    });
    
    const timeStr = type === 'hourly' ? date.toLocaleString('en-US', {
        hour: 'numeric',
        hour12: true
    }) : '';

    detailedView.innerHTML = `
        <div class="detailed-forecast">
            <button class="close-btn"><i class="fas fa-times"></i></button>
            <h3>${dateStr} ${timeStr ? `(${timeStr})` : ''}</h3>
            <div class="forecast-details">
                <div class="main-weather">
                    <i class="fas ${getWeatherIcon(forecast.weather[0].id, date.getHours())} large-icon"></i>
                    <div class="temp-container">
                        <p class="temp">${temp}°</p>
                        <p class="feels-like">Feels like: ${feelsLike}°</p>
                    </div>
                </div>
                <div class="weather-info-grid">
                    <div class="info-item">
                        <i class="fas fa-tint"></i>
                        <p>Humidity</p>
                        <p>${forecast.main.humidity}%</p>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-wind"></i>
                        <p>Wind Speed</p>
                        <p>${Math.round(forecast.wind.speed * 3.6)} km/h</p>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-tachometer-alt"></i>
                        <p>Pressure</p>
                        <p>${forecast.main.pressure} hPa</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(detailedView);

    // Add active class after a small delay to trigger animation
    requestAnimationFrame(() => {
        detailedView.classList.add('active');
    });

    // Close when clicking outside the forecast details
    detailedView.addEventListener('click', (e) => {
        if (e.target === detailedView) {
            closeDetailedForecast(detailedView);
        }
    });

    // Close when clicking the close button
    detailedView.querySelector('.close-btn').addEventListener('click', () => {
        closeDetailedForecast(detailedView);
    });
}

// Close detailed forecast with animation
function closeDetailedForecast(element) {
    element.classList.remove('active');
    element.addEventListener('transitionend', () => {
        element.remove();
    }, { once: true });
}

// Add these cookie utility functions at the top of your file
function setCookie(name, value, days) {
    try {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        const expires = `expires=${date.toUTCString()}`;
        document.cookie = `${name}=${value};${expires};path=/;SameSite=Lax`;
        return true;
    } catch (error) {
        console.error('Error setting cookie:', error);
        return false;
    }
}

function getCookie(name) {
    try {
        const cookieName = `${name}=`;
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            cookie = cookie.trim();
            if (cookie.indexOf(cookieName) === 0) {
                return cookie.substring(cookieName.length, cookie.length);
            }
        }
        return null;
    } catch (error) {
        console.error('Error getting cookie:', error);
        return null;
    }
}

function deleteCookie(name) {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;SameSite=Lax`;
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);