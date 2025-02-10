import express from "express";
import path from "path";
import fs from "fs";
import cron from "node-cron";
import fetch from "node-fetch"; // Using ES Module import
import { config } from "dotenv";

// Load environment variables
config(); // Loads environment variables

const app = express();
const port = 3000;

// Use import.meta.url to get the directory name
const __dirname = path.dirname(new URL(import.meta.url).pathname);

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, "public")));

// Serve static files from the 'data' folder (contains flight_history.json)
app.use("/data", express.static(path.join(__dirname, "data")));

// Endpoint to serve the API key
app.get("/api-key", (req, res) => {
    res.json({ apiKey: process.env.API_KEY });
});

// Function to fetch balloon data
async function fetchBalloonData(hoursAgo) {
    const url = `https://a.windbornesystems.com/treasure/${String(
        hoursAgo
    ).padStart(2, "0")}.json`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            if (response.status === 404) {
                return null; // Skip this hour if data is not found
            }
            throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
        }
        let text = await response.text();
        text = text
            .trim()
            .replace(/NaN/g, "null")
            .replace(/,\s*]/g, "]")
            .replace(/,\s*}/g, "}");

        const openBrackets = (text.match(/\[/g) || []).length;
        const closeBrackets = (text.match(/\]/g) || []).length;
        if (openBrackets > closeBrackets) {
            text += "]".repeat(openBrackets - closeBrackets);
        } else if (closeBrackets > openBrackets) {
            text = "[".repeat(closeBrackets - openBrackets) + text;
        }

        try {
            let data = JSON.parse(text);
            if (!Array.isArray(data)) throw new Error("Data is not an array");
            data = filterValidBalloonData(data);
            return data.length > 0 ? data : null;
        } catch (jsonError) {
            console.warn(`Invalid JSON for ${hoursAgo}H ago:`, jsonError);
            return null;
        }
    } catch (error) {
        console.warn(`Error fetching data for ${hoursAgo}H ago:`, error);
        return null;
    }
}

function filterValidBalloonData(data) {
    return data.filter(
        (entry) =>
            Array.isArray(entry) &&
            entry.length === 3 &&
            entry.every((coord) => typeof coord === "number" && !isNaN(coord))
    );
}

// Function to update balloon data
async function fetchFullFlightHistory() {
    console.log("Updating balloon data...");
    const history = [];
    const missingHours = [];
    for (let i = 0; i <= 23; i++) {
        const data = await fetchBalloonData(i);
        if (data) {
            history.push({ hoursAgo: i, data });
        } else {
            missingHours.push(i);
        }
    }

    const outputData = { history, missingHours };
    const filePath = "./data/flight_history.json";

    try {
        fs.writeFileSync(filePath, JSON.stringify(outputData, null, 2));
        console.log(
            `Data successfully updated at ${new Date().toLocaleTimeString()}`
        );
    } catch (err) {
        console.error("Error saving data to file:", err);
    }
}

// Function to fetch earthquake data
async function fetchEarthquakeData() {
    const url =
        "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=" +
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() +
        "&minmagnitude=4";

    try {
        const response = await fetch(url);
        const data = await response.json();

        // Save the earthquake data with geometry to a file
        const filePath = "./data/earthquake_data.json";

        try {
            fs.writeFileSync(filePath, JSON.stringify(data.features, null, 2));
            console.log(
                `Earthquake data successfully updated at ${new Date().toLocaleTimeString()}`
            );
        } catch (err) {
            console.error("Error saving earthquake data:", err);
        }
    } catch (error) {
        console.error("Error fetching earthquake data:", error);
    }
}

// Schedule earthquake data fetch every 30 minutes (use node-cron)
cron.schedule("*/30 * * * *", fetchEarthquakeData); // Runs every 30 minutes

// Schedule balloon data fetch every 30 minutes (use node-cron)
cron.schedule("*/30 * * * *", fetchFullFlightHistory); // Runs every 30 minutes

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

// Initial call to populate data on server start
fetchFullFlightHistory();

// Initial call to populate data on server start
fetchEarthquakeData();
