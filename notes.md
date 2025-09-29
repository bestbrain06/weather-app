# 📝 Weather App Architecture: Core Concepts & Unit Switching

This document outlines the fundamental structure of the weather application and, crucially, explains the logic implemented for dynamic unit conversion (Metric $\leftrightarrow$ Imperial).

---

## 1. App State & Data Management (The Memory)

The application's ability to switch units instantly relies on maintaining two core global variables (or "state") in the JavaScript.

| Variable            | Purpose                        | Value & Importance                                                                                                                                                                                                  |
| :------------------ | :----------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`lastFetchData`** | **Raw, Original Data Storage** | Holds the complete weather data fetched from the API (always in **Metric**). This data is **NEVER modified**. This allows the app to switch back and forth between units without re-fetching data.                  |
| **`currentUnits`**  | **Display State Tracker**      | An object (`{temp: 'celsius', wind: 'kmh', precip: 'mm'}`) that tracks which units are currently visible to the user. This is used by the display functions to show the correct label (e.g., **`°C`** vs **`°F`**). |

---

## 2. The Unit Conversion Flow (The Control Loop)

The entire unit switching process follows a clean, five-step loop whenever a user clicks a unit selector or the main toggle button.

1.  **Event Fired:** A user clicks a radio button or the "Switch to..." button, triggering an event listener.
2.  **`processUnitChange()` Runs:** This master function executes the following:
    - Reads the new desired units from the checked radio buttons.
    - Updates the **`currentUnits`** global state.
3.  **Data Conversion:** It calls **`convertWeatherData(lastFetchData, ...)`**.
    - It creates a **deep copy** of the original **`lastFetchData`** (the raw Metric data). This is the key to **non-destructive conversion**.
    - It applies the necessary conversion formulas (e.g., `tempCelsiusToFahrenheit`) only to the values that need changing.
    - It returns the new, converted data object.
4.  **UI Re-Rendering:** The code calls **all display functions** (`displayCurrentWeather()`, `displayDailyForecast()`, etc.), passing them the **newly converted data**.
5.  **Label Update:** The display functions read the new **`currentUnits`** state and render the correct labels (**`°F`**, **`mph`**, etc.) alongside the converted numbers.

---

## 3. Key Functions for Unit Switching

| Function Name                  | Role in the System                                                                                                                             | Key Implementation Detail                                                                                                                                     |
| :----------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`convertWeatherData()`**     | **Data Engine.** Takes the raw data and desired units, returns a brand new, converted data object.                                             | **Crucial:** Uses `JSON.parse(JSON.stringify(rawData))` to make a copy. Uses `.map()` to convert large arrays (hourly/daily temps) efficiently.               |
| **`processUnitChange()`**      | **Master Controller.** Runs the entire flow (reads input $\rightarrow$ updates state $\rightarrow$ converts data $\rightarrow$ calls display). | Runs on every individual unit change (`change` event on radio buttons).                                                                                       |
| **`toggleAllUnits()`**         | **Macro Toggler.** Handles the "Switch to Imperial/Metric" button.                                                                             | Programmatically sets the **`.checked = true`** property on all three target radio buttons, then calls `processUnitChange()`.                                 |
| **`updateUnitActiveStates()`** | **Visual Manager.** Synchronizes the visual unit selector with the hidden radio button state.                                                  | Iterates over radio buttons, adding or removing the **`.active`** class based on the **`.checked`** property, which your CSS uses to style the visible label. |
| **`display*` Functions**       | **UI Renderer.** Renders the data to the DOM.                                                                                                  | They must dynamically check the **`currentUnits`** object to select the correct unit string for the data being displayed.                                     |

---

## 4. Frontend Best Practices

- **Hidden Radio Buttons:** The radio inputs are hidden using CSS (`clip: rect(0 0 0 0);`) while the associated `<label>` (the **`.unit-selector`**) is used as the visible, clickable element. This ensures **accessibility** and allows for custom styling.
- **CSS Class Management:** The **`.active`** class is only ever added to the **hidden radio button input**. Your CSS uses the **Adjacent Sibling Selector** (`input[type="radio"].active + .unit-selector`) to correctly style the visible label when the input is selected.
