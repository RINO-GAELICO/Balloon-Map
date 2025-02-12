let map;
let markers = [];
let flightData = {};
let playInterval = null;
let isPlaying = false;
let fullTrackMode = false;
let showPathAsLine = false;
let flightPath = null;
let googleMapsLoaded = false;
let counterClick = 0;

// Fetch API key and load Google Maps
fetch("/api-key")
    .then((response) => response.json())
    .then((data) => loadGoogleMaps(data.apiKey))
    .catch((error) => console.error("Error fetching API key:", error));

// Function to load Google Maps dynamically
function loadGoogleMaps(apiKey) {
    if (googleMapsLoaded) return;
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initializeMap`;
    script.async = true;
    script.defer = true;
    script.onerror = () => console.error("Error loading Google Maps API.");
    document.body.appendChild(script);
    googleMapsLoaded = true;
}

// Initialize the map
function initializeMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        zoom: 2,
        center: { lat: 0, lng: 0 },
    });

    fetch("data/flight_history.json")
        .then((response) => response.json())
        .then((data) => (flightData = data))
        .catch((error) => console.error("Error loading JSON:", error));

    // Slider event
    document
        .getElementById("slider")
        .addEventListener("input", handleSliderChange);
    document
        .getElementById("balloon-number")
        .addEventListener("input", handleBalloonNumberChange);

    // Play button event
    document
        .getElementById("play-button")
        .addEventListener("click", handlePlayButtonClick);

    // Toggle Full Track mode
    document
        .getElementById("toggle-track-button")
        .addEventListener("click", handleTrackButtonClick);

    // Toggle between markers and polyline
    document
        .getElementById("toggle-path-button")
        .addEventListener("click", togglePath);
}

// Handle play button click event
function handlePlayButtonClick(e) {
    e.preventDefault();
    if (isPlaying) {
        stopPlay();
    } else {
        startPlay();
    }
}

// Handle slider change event
function handleSliderChange(e) {
    document.getElementById("hour-display").textContent = e.target.value;
    loadMarkersForSelectedBalloonAndHour(parseInt(e.target.value));
}

// Handle balloon number change event
function handleBalloonNumberChange() {
    if (fullTrackMode) showFullTrack();
    else
        loadMarkersForSelectedBalloonAndHour(
            parseInt(document.getElementById("slider").value)
        );
}

// Handle toggle track button click event
function handleTrackButtonClick() {
    counterClick++;
    console.log("Counter Click:", counterClick);
    console.log("Toggle Full Track button clicked!");
    console.log("Full Track Mode:", fullTrackMode);

    const previousFullTrackMode = fullTrackMode;
    fullTrackMode = !fullTrackMode;
    console.log("Full Track Mode toggled:", fullTrackMode);

    toggleTrackUIState(previousFullTrackMode);
}

// Toggle track mode UI
function toggleTrackUIState(previousFullTrackMode) {
    const toggleButton = document.getElementById("toggle-track-button");
    const pathToggleButton = document.getElementById("toggle-path-button");
    const sliderContainer = document.getElementById("slider").parentElement;
    const playButton = document.getElementById("play-button");

    if (fullTrackMode) {
        toggleButton.textContent = "Show Single Position";
        sliderContainer.style.display = "none";
        playButton.style.display = "none";
        pathToggleButton.style.display = "block";
        console.log("Entering fullTrackMode");

        if (previousFullTrackMode !== fullTrackMode) {
            console.log("Calling showFullTrack()...");
            showFullTrack();
        }
    } else {
        toggleButton.textContent = "Show Full Track";
        sliderContainer.style.display = "block";
        playButton.style.display = "block";
        pathToggleButton.style.display = "none";
        console.log("Exiting fullTrackMode");

        const sliderValue = parseInt(document.getElementById("slider").value);
        if (previousFullTrackMode !== fullTrackMode) {
            console.log("Slider value:", sliderValue);
            console.log(
                "Calling loadMarkersForSelectedBalloonAndHour() with value:",
                sliderValue
            );
            loadMarkersForSelectedBalloonAndHour(sliderValue);
        }
    }
    console.log("Finished toggle-track-button event...");
}

// Toggle between markers and polyline
function togglePath() {
    showPathAsLine = !showPathAsLine;
    document.getElementById("toggle-path-button").textContent = showPathAsLine
        ? "Show as Markers"
        : "Show as Line";
    showFullTrack(); // Refresh view
}

// Start Play
function startPlay() {
    if (!flightData.history || flightData.history.length === 0) {
        console.error("Flight data is not loaded yet.");
        return;
    }
    console.log("Starting play...");

    isPlaying = true;
    document.getElementById("play-button").textContent = "Stop";

    playInterval = setInterval(() => {
        let currentHour = parseInt(document.getElementById("slider").value);
        currentHour = (currentHour + 1) % 24;
        document.getElementById("slider").value = currentHour;
        document.getElementById("hour-display").textContent = currentHour;
        loadMarkersForSelectedBalloonAndHour(currentHour);
    }, 500);
    console.log("Finished starting play...");
}

// Stop Play
function stopPlay() {
    isPlaying = false;
    console.log("Stopping play...");
    document.getElementById("play-button").textContent = "Play";
    clearInterval(playInterval);
}

// Load single position per hour
function loadMarkersForSelectedBalloonAndHour(hourIndex) {
    if (fullTrackMode) return;
    clearMap();

    const balloonNumber = parseInt(
        document.getElementById("balloon-number").value
    );
    const flightHistory = flightData.history;

    if (balloonNumber < 1 || balloonNumber > flightHistory[0].data.length) {
        alert("Invalid balloon number.");
        return;
    }

    const hourData = flightHistory.find(
        (entry) => entry.hoursAgo === hourIndex
    );
    if (hourData && hourData.data.length >= balloonNumber) {
        const [lat, lng, altitude] = hourData.data[balloonNumber - 1];
        if (lat !== 0 && lng !== 0) {
            const marker = new google.maps.Marker({
                position: { lat, lng },
                map: map,
                title: `Altitude: ${altitude}m`,
            });

            marker.addListener("click", () => {
                alert(
                    `Balloon ${balloonNumber}\nLatitude: ${lat}\nLongitude: ${lng}\nAltitude: ${altitude}m`
                );
            });

            markers.push(marker);
        }
    }
}

// Show all positions for selected balloon
function showFullTrack() {
    clearMap();
    console.log("Finished clearing map...");

    const balloonNumber = parseInt(
        document.getElementById("balloon-number").value
    );
    const flightHistory = flightData.history;

    if (balloonNumber < 1 || balloonNumber > flightHistory[0].data.length) {
        alert("Invalid balloon number.");
        return;
    }

    const pathCoordinates = [];
    flightHistory.forEach((hourData) => {
        if (hourData.data.length >= balloonNumber) {
            const [lat, lng, altitude] = hourData.data[balloonNumber - 1];
            if (lat !== 0 && lng !== 0) {
                pathCoordinates.push({ lat, lng });

                if (!showPathAsLine) {
                    const marker = new google.maps.Marker({
                        position: { lat, lng },
                        map: map,
                        title: `Altitude: ${altitude}m (Hour: ${hourData.hoursAgo})`,
                    });

                    marker.addListener("click", () => {
                        alert(
                            `Balloon ${balloonNumber}\nLatitude: ${lat}\nLongitude: ${lng}\nAltitude: ${altitude}m\nHour: ${hourData.hoursAgo}`
                        );
                    });

                    markers.push(marker);
                }
            }
        }
    });

    console.log("Finished loading markers...");

    if (showPathAsLine && pathCoordinates.length > 1) {
        flightPath = new google.maps.Polyline({
            path: pathCoordinates,
            geodesic: true,
            strokeColor: "#FF0000",
            strokeOpacity: 1.0,
            strokeWeight: 2,
        });

        flightPath.setMap(map);
    }
    console.log("Finished loading path...");
}

// Clear markers and polylines
function clearMap() {
    markers.forEach((marker) => marker.setMap(null));
    markers = [];

    if (flightPath) {
        flightPath.setMap(null);
        flightPath = null;
    }
}

function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of Earth in km
    const toRad = (angle) => (angle * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

function findNearestBalloon(earthquake, flightData) {
    const { coordinates } = earthquake.geometry;
    const eqLat = coordinates[1];
    const eqLng = coordinates[0];
    const eqTime = new Date(earthquake.properties.time);
    const hoursAgo = Math.floor((Date.now() - eqTime) / (1000 * 60 * 60));

    const hourEntry = flightData.history.find(
        (entry) => entry.hoursAgo === hoursAgo
    );
    if (!hourEntry) return null; // No matching hour

    let nearestBalloon = null;
    let minDistance = Infinity;

    hourEntry.data.forEach((triplet, index) => {
        const [balloonLat, balloonLng] = triplet;
        const distance = haversine(eqLat, eqLng, balloonLat, balloonLng);

        if (distance < minDistance) {
            minDistance = distance;
            nearestBalloon = {
                index: index + 1,
                distance,
                balloonLat,
                balloonLng,
                hoursAgo,
            };
        }
    });

    return nearestBalloon;
}

function showBalloonOnMap(balloonIndex, hoursAgo) {
    // Set the balloon number
    document.getElementById("balloon-number").value = balloonIndex;

    // Set the slider value
    const slider = document.getElementById("slider");
    slider.value = hoursAgo;
    document.getElementById("hour-display").textContent = hoursAgo;

    // Manually trigger the slider's input event
    const event = new Event("input", { bubbles: true });
    slider.dispatchEvent(event);
}

function fetchEarthquakeData(flightData) {
    fetch("/data/earthquake_data.json")
        .then((response) => response.json())
        .then((data) => {
            const earthquakeList = document.getElementById("earthquake-list");
            earthquakeList.innerHTML = ""; // Clear previous data

            data.forEach((quake) => {
                const { mag, place, time } = quake.properties;
                const nearestBalloon = findNearestBalloon(quake, flightData);

                // Create the list item
                const listItem = document.createElement("li");
                listItem.classList.add("mb-2"); // Add some spacing between items

                // Create main earthquake info
                const mainText = document.createElement("span");
                mainText.innerHTML = `• <strong>M${mag}</strong> - ${place} - ${new Date(
                    time
                ).toLocaleString()}`;
                listItem.appendChild(mainText);

                // Create sub-info (nearest balloon)
                if (nearestBalloon) {
                    const subText = document.createElement("div");
                    subText.classList.add("ms-3", "text-muted"); // Indent and make text lighter
                    subText.innerHTML = `Nearest Balloon: #${
                        nearestBalloon.index
                    }, Distance: ${nearestBalloon.distance.toFixed(2)} km, ${
                        nearestBalloon.hoursAgo
                    } hrs ago`;

                    // Create the "Show" button
                    const showButton = document.createElement("button");
                    showButton.textContent = "Show";
                    showButton.classList.add(
                        "btn",
                        "btn-primary",
                        "btn-sm",
                        "ms-2"
                    ); // Bootstrap classes
                    const sliderContainer =
                        document.getElementById("slider").parentElement;
                    showButton.onclick = () => {
                        if (fullTrackMode) {
                            fullTrackMode = false; // Disable full track mode
                            const toggleButton = document.getElementById(
                                "toggle-track-button"
                            );
                            toggleButton.textContent = "Show Full Track"; // Reset the button text

                            // Hide the full track display and show the single position view
                            sliderContainer.style.display = "block";
                            document.getElementById(
                                "toggle-path-button"
                            ).style.display = "none";
                        }
                        showBalloonOnMap(
                            nearestBalloon.index,
                            nearestBalloon.hoursAgo
                        );
                    };
                    // Append elements
                    subText.appendChild(showButton);
                    listItem.appendChild(subText);
                } else {
                    const noDataText = document.createElement("div");
                    noDataText.classList.add("ms-3", "text-muted");
                    noDataText.textContent =
                        "No balloon data available at this hour.";
                    listItem.appendChild(noDataText);
                }

                earthquakeList.appendChild(listItem);
            });
        })
        .catch((error) =>
            console.error("Error fetching earthquake data:", error)
        );
}

async function fetchAndUpdateData() {
    try {
        // Fetch the API key dynamically if required
        const apiKey = await fetch("/api-key")
            .then((response) => response.json())
            .then((data) => data.apiKey);

        // Load Google Maps first
        loadGoogleMaps(apiKey);
        // Fetch flight data first
        const flightResponse = await fetch("data/flight_history.json");
        const flightData = await flightResponse.json();

        // Fetch earthquake data
        await fetchEarthquakeData(flightData); // Now fetch earthquakes with balloon data

        // Initialize map
        initializeMap(); // Initialize map after fetching data
    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

// Set the interval to fetch and update data every 30 minutes
setInterval(fetchAndUpdateData, 30 * 60 * 1000); // Runs every 30 minutes

// Call once on page load to initialize the data and map
fetchAndUpdateData();
