/* ==========================================================
// 1. GLOBAL STATE & UTILITY FUNCTIONS
//    (Variables and simple math functions)
========================================================== */

// Stores the raw, original weather data fetched from the API (always Metric).
let lastFetchData = null;

// This is used by the display functions to show the correct unit label (°F, mph, etc.).
let currentUnits = {
  temp: "celsius",
  wind: "kmh",
  precip: "mm",
};

// --- DOM Elements for Search Suggestions ---
const searchInput = document.querySelector(".js-search-input");
const suggestionsContainer = document.querySelector(
  ".search-suggestions-container"
);

// --- Conversion Functions ---

function tempCelsiusToFahrenheit(celsius) {
  return (celsius * 9) / 5 + 32;
}

function windKmhToMph(kmh) {
  return kmh * 0.621371;
}

function precipMmToIn(mm) {
  return mm / 25.4;
}

// --- Weather Icon Mapping ---

function getIcon(code) {
  switch (code) {
    // Clear / Sunny
    case 0:
      return "assets/images/icon-sunny.webp";
    // Clouds / Partly Cloudy / Overcast
    case 1:
    case 2:
      return "assets/images/icon-partly-cloudy.webp"; // Clear to partly cloudy
    case 3:
      return "assets/images/icon-overcast.webp"; // Overcast
    // Fog
    case 45:
    case 48:
      return "assets/images/icon-fog.webp";
    // Drizzle
    case 51:
    case 53:
    case 55:
      return "assets/images/icon-drizzle.webp";
    // Rain
    case 61:
    case 63:
    case 65:
      return "assets/images/icon-rain.webp";
    // Snow / Snow Grains
    case 71:
    case 73:
    case 75:
    case 77: // Snow grains
      return "assets/images/icon-snow.webp";
    // Thunderstorm
    case 95:
    case 96:
    case 99:
      return "assets/images/icon-storm.webp";
    default:
      return "assets/images/icon-sunny.webp";
  }
}

/* ==========================================================
// 2. DATA FETCHING AND PREPARATION
//    (Functions that call the APIs)
========================================================== */

function toggleLoading(isLoading) {
  const loadingEl = document.querySelector(".weather-info-loading-container");
  const currentWeatherEl = document.querySelector(".weather-info-container");
  const placeHolderSelect = document.querySelector(".place-holder-select");
  const daySelector = document.querySelector(".day-selector");

  if (isLoading) {
    loadingEl.classList.add("hide");
    placeHolderSelect.classList.add("hide");
    currentWeatherEl.classList.remove("hide");
    daySelector.classList.remove("hide");
  } else {
    loadingEl.classList.remove("hide");
    placeHolderSelect.classList.remove("hide");
    currentWeatherEl.classList.add("hide");
    daySelector.classList.add("hide");
  }
}

async function getCoordinates(locationString) {
  // 1. START LOADING
  toggleLoading(true);

  const search = locationString;
  const url = `https://nominatim.openstreetmap.org/search?q=${search}&format=jsonv2`;
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }

    const result = await response.json();

    if (result.length > 0) {
      return {
        lat: result[0].lat,
        lon: result[0].lon,
        name: result[0].display_name,
      };
    } else {
      return null;
    }
  } catch (error) {
    console.error(error.message);
    return null;
  }
}

async function getWeatherData(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_min,temperature_2m_max&hourly=temperature_2m,weather_code&current=temperature_2m,precipitation,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }

    const result = await response.json();
    console.log("Raw Weather Data:", result);
    return result;
  } catch (error) {
    console.error(error.message);
    return null;
  }
}

async function fetchWeatherForLocation(locationString) {
  const coords = await getCoordinates(locationString);

  if (!coords) {
    // Handle case where location wasn't found
    return;
  }

  const weatherData = await getWeatherData(coords.lat, coords.lon);

  if (weatherData) {
    let rawLocationName = coords.name;
    let simplifiedName = rawLocationName;

    const parts = rawLocationName.split(",");

    if (parts.length > 1) {
      // Simplify location name (e.g., city, country)
      simplifiedName = `${parts[0].trim()}, ${parts[parts.length - 1].trim()}`;
    }

    const finalData = {
      locationName: simplifiedName,
      weather: weatherData,
    };

    // Store the raw data globally
    lastFetchData = finalData;

    console.log("Successfully fetched and combined data:", finalData);

    // Display the data using the initial 'celsius' setting
    displayCurrentWeather(finalData);
    displayDailyForecast(finalData);
    const initialDate = populateDaySelector(finalData);
    displayHourlyForecast(finalData, initialDate);

    // Set up the listener for the day selector
    const daySelectorEl = document.querySelector(".js-day-selector");
    daySelectorEl.addEventListener("change", (e) => {
      const selectedDate = e.target.value;
      // The `finalData` passed here is the RAW data. We must ensure
      // the display function knows what unit to use (which it does via currentUnits).
      displayHourlyForecast(finalData, selectedDate);
    });

    // Ensure the unit active state and button text are correct on load
    updateUnitActiveStates();
    updateUnitToggleButton(currentUnits.temp);
    getFormattedCurrentDate();

    return finalData;
  }
}

/* ==========================================================
// 3. DATA CONVERSION LOGIC (Master Controller)
========================================================== */

// This function takes raw data and converts it based on the requested unit system.
function convertWeatherData(rawData, tempUnit, windUnit, precipUnit) {
  // We clone the original data so we don't modify the globally stored 'lastFetchData'.
  const convertedData = JSON.parse(JSON.stringify(rawData));
  const weather = convertedData.weather;

  // --- 1. TEMPERATURE CONVERSION ---
  if (tempUnit === "fahrenheit") {
    // Convert Current and Feels Like
    weather.current.temperature_2m = tempCelsiusToFahrenheit(
      weather.current.temperature_2m
    );
    weather.current.apparent_temperature = tempCelsiusToFahrenheit(
      weather.current.apparent_temperature
    );

    // Convert Daily Min/Max Arrays using the .map() method
    weather.daily.temperature_2m_min = weather.daily.temperature_2m_min.map(
      (temp) => tempCelsiusToFahrenheit(temp)
    );
    weather.daily.temperature_2m_max = weather.daily.temperature_2m_max.map(
      (temp) => tempCelsiusToFahrenheit(temp)
    );

    // Convert Hourly Temperatures Array
    weather.hourly.temperature_2m = weather.hourly.temperature_2m.map((temp) =>
      tempCelsiusToFahrenheit(temp)
    );
  }

  // --- 2. WIND SPEED CONVERSION ---
  if (windUnit === "mph") {
    weather.current.wind_speed_10m = windKmhToMph(
      weather.current.wind_speed_10m
    );
  }

  // --- 3. PRECIPITATION CONVERSION ---
  if (precipUnit === "in") {
    weather.current.precipitation = precipMmToIn(weather.current.precipitation);
  }

  // Return the new, converted data object
  return convertedData;
}

/* ==========================================================
// 4. UI RENDERING FUNCTIONS (Dynamic Unit Labels)
//    (These update the DOM)
========================================================== */

function getFormattedCurrentDate() {
  const today = new Date();

  // Define the required format options
  const options = {
    weekday: "long", // Monday
    month: "short", // Aug
    day: "numeric", // 29
    year: "numeric", // 2025
  };

  // Create the formatter object for US English (which matches the requested format)
  const formatter = new Intl.DateTimeFormat("en-US", options);

  document.querySelector(".date").textContent = formatter.format(today);
}

function displayCurrentWeather(data) {
  const locationEl = document.querySelector(".location");
  const currentTempEl = document.querySelector(".temperature-current");
  const apperantTemperatureEl = document.querySelector(
    ".js-apperant-temperature"
  );
  const humidityEl = document.querySelector(".js-humidity");
  const windSpeedEl = document.querySelector(".js-wind-speed");
  const precipitationEl = document.querySelector(".js-precipitation");

  // DYNAMIC UNIT LABELS: Check the global state to get the correct suffix
  const tempUnitLabel = currentUnits.temp === "fahrenheit" ? "°" : "°";
  const windUnitLabel = currentUnits.wind === "mph" ? "mph" : "km/h";
  const precipUnitLabel = currentUnits.precip === "in" ? "in" : "mm";

  locationEl.textContent = data.locationName;

  // Current Temperature
  currentTempEl.textContent = `${data.weather.current.temperature_2m.toFixed(
    0
  )}${tempUnitLabel}`;

  // Feels Like Temperature
  apperantTemperatureEl.textContent = `${data.weather.current.apparent_temperature.toFixed(
    0
  )}${tempUnitLabel}`;

  // Humidity (always %)
  humidityEl.textContent = `${data.weather.current.relative_humidity_2m}%`;

  // Wind Speed
  windSpeedEl.textContent = `${data.weather.current.wind_speed_10m.toFixed(
    0
  )} ${windUnitLabel}`;

  // Precipitation
  precipitationEl.textContent = `${data.weather.current.precipitation.toFixed(
    1
  )} ${precipUnitLabel}`;
}

function displayDailyForecast(data) {
  const dailyData = data.weather.daily;
  let weatherCardHTML = "";

  // DYNAMIC UNIT LABEL: Check the global state
  const tempUnitLabel = currentUnits.temp === "fahrenheit" ? "°" : "°";

  for (let i = 0; i < dailyData.time.length; i++) {
    const date = new Date(dailyData.time[i]);
    const dayOfWeek = date.toLocaleDateString("en-US", { weekday: "short" });

    weatherCardHTML += `
<div class="weather-card">
    <span class="day-label">${dayOfWeek}</span>
    <img src="${getIcon(dailyData.weather_code[i])}" alt="weather icon" />
    <div class="temperature-range">
        <span class="temperature">${dailyData.temperature_2m_min[i].toFixed(
          0
        )}${tempUnitLabel}</span>
        <span class="temperature">${dailyData.temperature_2m_max[i].toFixed(
          0
        )}${tempUnitLabel}</span>
    </div>
</div>
        `;
  }

  document.querySelector(".cards-wrapper").innerHTML = weatherCardHTML;
}

function populateDaySelector(data) {
  const dailyData = data.weather.daily;
  const daySelectorEl = document.querySelector(".js-day-selector");
  daySelectorEl.innerHTML = "";
  let optionsHTML = "";

  for (let i = 0; i < dailyData.time.length; i++) {
    const dateString = dailyData.time[i];
    const date = new Date(dateString);
    const fullDayName = date.toLocaleDateString("en-US", { weekday: "long" });

    optionsHTML += `
            <option value="${dateString}">${fullDayName}</option>
        `;
  }

  daySelectorEl.innerHTML = optionsHTML;

  return dailyData.time[0];
}

function displayHourlyForecast(data, dateString) {
  const hourlyData = data.weather.hourly;

  // DYNAMIC UNIT LABEL: Check the global state
  const tempUnitLabel = currentUnits.temp === "fahrenheit" ? "°" : "°";

  const startIndex = hourlyData.time.findIndex((time) =>
    time.startsWith(dateString)
  );

  let hourlyHTML = "";

  for (let i = startIndex; i < startIndex + 24; i++) {
    const timeString = hourlyData.time[i];
    const tempValue = hourlyData.temperature_2m[i];

    const date = new Date(timeString);
    const formattedTime = date.toLocaleTimeString("en-US", {
      hour: "numeric",
    });

    hourlyHTML += `
<div class="hourly-forecast-card">
    <div class="hourly-forecast-time-wrapper">
        <img src="${getIcon(hourlyData.weather_code[i])}" alt="weather icon" />
        <span class="hourly-forecast-time">${formattedTime}</span>
    </div>
    <span class="hourly-forecast-temperature">${tempValue.toFixed(
      0
    )}${tempUnitLabel}</span>
</div>
        `;
  }

  document.querySelector(".hourly-forecast-card-container").innerHTML =
    hourlyHTML;
}

/* ==========================================================
// 5. UNIT SWITCHING LOGIC (Event Handlers)
========================================================== */

// --- Unit Controller ---
function processUnitChange() {
  if (!lastFetchData) {
    console.warn("No weather data available to convert.");
    return;
  }

  // 1. Read the newly selected units from the checked radio buttons
  const tempUnit = document.querySelector(
    'input[name="temp-unit"]:checked'
  ).value;
  const windUnit = document.querySelector(
    'input[name="wind-unit"]:checked'
  ).value;
  const precipUnit = document.querySelector(
    'input[name="precip-unit"]:checked'
  ).value;

  // 2. Update the visual active class on the inputs/labels
  updateUnitActiveStates();

  // 3. Update the global unit state
  currentUnits = { temp: tempUnit, wind: windUnit, precip: precipUnit };

  // 4. Convert the data: Pass the RAW data to the converter to get the converted data.
  const dataToDisplay = convertWeatherData(
    lastFetchData,
    tempUnit,
    windUnit,
    precipUnit
  );

  // 5. Re-render the UI with the converted data
  displayCurrentWeather(dataToDisplay);
  displayDailyForecast(dataToDisplay);

  // Re-run hourly forecast with the converted data for the currently selected day
  const selectedDate = document.querySelector(".js-day-selector").value;
  displayHourlyForecast(dataToDisplay, selectedDate);

  // 6. Update the main toggle button text
  updateUnitToggleButton(tempUnit);
}

// Handles the 'active' class on the hidden radio buttons to style the labels
function updateUnitActiveStates() {
  // Select all unit radio buttons (inputs whose name ends with -unit)
  const allUnitInputs = document.querySelectorAll('input[name$="-unit"]');

  allUnitInputs.forEach((input) => {
    if (input.checked) {
      // If checked, ensure it has the 'active' class (CSS styles the label)
      input.classList.add("active");
    } else {
      // Otherwise, remove it
      input.classList.remove("active");
    }
  });
}

// Updates the text on the 'Switch to Imperial/Metric' button
function updateUnitToggleButton(currentTempUnit) {
  const toggleButton = document.querySelector(".dropdown-toggle-button");
  if (currentTempUnit === "celsius") {
    toggleButton.textContent = "Switch to Imperial";
  } else {
    toggleButton.textContent = "Switch to Metric";
  }
}

// Toggles the checked status of all units at once (for the 'Switch to Imperial' button)
function toggleAllUnits() {
  const isCurrentlyMetric = currentUnits.temp === "celsius";
  const targetTemp = isCurrentlyMetric ? "fahrenheit" : "celsius";
  const targetWind = isCurrentlyMetric ? "mph" : "kmh";
  const targetPrecip = isCurrentlyMetric ? "in" : "mm";

  // Programmatically check the target radio buttons
  // 1. Programmatically check the temperature radio button
  // HTML IDs: temp-c, temp-f
  const tempElement = document.getElementById(`temp-${targetTemp.charAt(0)}`);
  if (tempElement) {
    tempElement.checked = true;
  } else {
    console.error(`Missing radio button element: temp-${targetTemp.charAt(0)}`);
    return;
  }

  // 2. Programmatically check the wind radio button
  // HTML IDs: wind-kmh, wind-mph
  const windElement = document.getElementById(`wind-${targetWind}`);
  if (windElement) {
    windElement.checked = true;
  } else {
    console.error(`Missing radio button element: wind-${targetWind}`);
    return;
  }

  // 3. Programmatically check the precipitation radio button
  // HTML IDs: precip-mm, precip-in
  const precipElement = document.getElementById(`precip-${targetPrecip}`);
  if (precipElement) {
    precipElement.checked = true;
  } else {
    console.error(`Missing radio button element: precip-${targetPrecip}`);
    return;
  }

  // Trigger the process function to update data, active classes, and UI
  processUnitChange();
}

// --- Listener Setup ---

// This function adds the event listeners for both the individual radio buttons and the main toggle button
function setupUnitListeners() {
  // 1. Listen for changes on the individual unit radio buttons
  const unitSelectors = document.querySelectorAll(
    'input[name="temp-unit"], input[name="wind-unit"], input[name="precip-unit"]'
  );
  unitSelectors.forEach((input) => {
    // When any unit input changes, run the master controller
    input.addEventListener("change", processUnitChange);
  });

  // 2. Listen for the main "Switch to Imperial/Metric" button
  const mainToggleButton = document.querySelector(".dropdown-toggle-button");
  mainToggleButton.addEventListener("click", toggleAllUnits);
}

// --- Menu Dropdown Listener ---

function setupMenuListener() {
  const menuButton = document.querySelector(".menu-button");
  const unitsPanel = document.querySelector(".units-panel");

  menuButton.addEventListener("click", () => {
    unitsPanel.classList.toggle("hide");
    const isExpanded = menuButton.getAttribute("aria-expanded") === "true";
    menuButton.setAttribute("aria-expanded", !isExpanded);
  });
}

/* ==========================================================
// 6. INITIALIZATION
//    (Functions that run when the script loads)
========================================================== */

function setupSearchHandler() {
  const searchButton = document.querySelector(".js-search-button");

  searchButton.addEventListener("click", (e) => {
    e.preventDefault();
    const locationString = searchInput.value;
    searchInput.value = "";
    toggleSuggestions(false);

    if (locationString) {
      fetchWeatherForLocation(locationString);
    }
  });

  // --- 2. Listener for real-time INPUT (Autofill) ---
  searchInput.addEventListener("input", async (e) => {
    const query = e.target.value.trim();

    if (query.length < 3) {
      toggleSuggestions(false); // Hide if less than 3 characters
      return;
    }

    const suggestions = await fetchSuggestions(query);
    displaySuggestions(suggestions);
  });

  // Optional: Add a listener to hide the suggestions if the user clicks anywhere else
  document.addEventListener("click", (e) => {
    // Check if the click was NOT inside the search box or the suggestions
    if (!e.target.closest(".search-box-container")) {
      toggleSuggestions(false);
    }
  });
}

// Run the initial setup functions
setupSearchHandler();
setupUnitListeners(); // Activates the unit switching logic
setupMenuListener(); // Activates the units dropdown toggle

// Initial weather data fetch
// fetchWeatherForLocation("accra,ghana");

/* ==========================================================
// 7. GLOBAL STATE & UTILITY FUNCTIONS
// ... (existing code for lastFetchData, currentUnits, etc.)
========================================================== */

// --- Utility to toggle suggestion box visibility ---
function toggleSuggestions(show) {
  if (show) {
    suggestionsContainer.classList.remove("hide");
  } else {
    suggestionsContainer.classList.add("hide");
    suggestionsContainer.innerHTML = ""; // Clear old results when hiding
  }
}

// --- Search suggestions logic

async function fetchSuggestions(locationString) {
  const search = locationString;
  // Use 'limit=5' to fetch a reasonable number of results for the dropdown
  const url = `https://nominatim.openstreetmap.org/search?q=${search}&format=jsonv2&limit=5`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }
    const result = await response.json();
    return result; // Returns an array of results
  } catch (error) {
    console.error("Error fetching suggestions:", error.message);
    return [];
  }
}

function handleSuggestionClick(e) {
  // Get the location string we stored on the element's data attribute
  const locationString = e.currentTarget.dataset.location;

  // 1. Clear input and hide the suggestion box
  searchInput.value = "";
  toggleSuggestions(false);

  // 2. Fetch the weather for the selected location (using existing function)
  fetchWeatherForLocation(locationString);
}

function displaySuggestions(data) {
  // Define a comprehensive list of types that indicate a major settlement
  const majorSettlementTypes = [
    "city",
    "town",
    "village",
    "suburb",
    "hamlet",
    "capital",
  ];

  const filteredData = data.filter((item) => {
    // Priority 1: Check for the precise 'addresstype' (most reliable tag)
    if (item.addresstype === "city" || item.addresstype === "town") {
      return true;
    }

    // Priority 2: Fallback for partial/ambiguous searches (like "los")
    // Check if the item's 'type' is one of the major settlement types,
    // combined with a broad 'class' check for location/boundary.
    if (
      majorSettlementTypes.includes(item.type) &&
      (item.class === "place" ||
        item.class === "boundary" ||
        item.class === "landuse")
    ) {
      return true;
    }

    return false; // Exclude all other results (e.g., roads, buildings)
  });

  // Clear any existing suggestions
  suggestionsContainer.innerHTML = "";

  if (filteredData.length === 0) {
    toggleSuggestions(false);
    return;
  }

  let suggestionsHTML = "";

  filteredData.forEach((item) => {
    // 1. Get the raw, full display name for the accurate API call
    let rawName = item.display_name;

    // 2. Simplify the name to 'City, Country' format for display
    const parts = rawName
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    // Get the first part (City) and the last part (Country)
    const city = parts[0];
    const country = parts[parts.length - 1];

    // Combine them into the desired display format: "City, Country"
    let displayFormat = `${city}, ${country}`;

    // IMPORTANT: Check if city and country are the same (e.g., 'Monaco, Monaco')
    // and prevent repetition if they are.
    if (city === country) {
      displayFormat = city;
    }

    // 3. Create the HTML.
    suggestionsHTML += `
            <div class="city-option" data-location="${rawName}"> 
                <span class="city-name">${displayFormat}</span>
            </div>
        `;
  });

  suggestionsContainer.innerHTML = suggestionsHTML;
  // Show the container (toggleSuggestions function is defined in Section 1)
  toggleSuggestions(true);

  // CRITICAL: Attach event listeners to the newly created elements
  const suggestionElements = document.querySelectorAll(
    ".search-suggestions-container .city-option"
  );
  suggestionElements.forEach((el) => {
    el.addEventListener("click", handleSuggestionClick);
  });
}
