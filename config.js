const config = {
    API_KEY: process.env.OPENWEATHER_API_KEY || '',
    BASE_URL: process.env.WEATHER_BASE_URL || 'https://api.openweathermap.org/data/2.5',
    GEOCODING_URL: process.env.GEOCODING_BASE_URL || 'https://api.openweathermap.org/geo/1.0/direct',
    ICON_URL: process.env.WEATHER_ICON_URL || 'https://openweathermap.org/img/wn/'
};

export default config;