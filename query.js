
const fs = require('fs');

async function fetchBalloonData(hoursAgo) {
    const url = `https://a.windbornesystems.com/treasure/${String(hoursAgo).padStart(2, '0')}.json`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            if (response.status === 404) {
                // console.warn(`Data for ${hoursAgo}H ago not found, skipping.`);
                return null;  // Skip this hour and return null if not found
            }
            throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
        }
        let text = await response.text();
        text = text.trim().replace(/NaN/g, "null"); // Replace NaN with null to ensure valid JSON
        text = text.replace(/,\s*]/g, "]").replace(/,\s*}/g, "}"); // Remove trailing commas


        // Trim leading and trailing whitespace/newlines
        text = text.trim();
        // Count the number of opening and closing brackets
        const openBrackets = (text.match(/\[/g) || []).length;
        const closeBrackets = (text.match(/\]/g) || []).length;

        // Check for mismatched brackets
        if (openBrackets > closeBrackets) {
            // console.warn(`Mismatch: More opening brackets than closing brackets, adding closing brackets. Index: ${hoursAgo}`);
            text += "]".repeat(openBrackets - closeBrackets);  // Add missing closing brackets at the end
        } else if (closeBrackets > openBrackets) {
            // console.warn(`Mismatch: More closing brackets than opening brackets, adding opening brackets. Index: ${hoursAgo}`);
            text = "[".repeat(closeBrackets - openBrackets) + text;  // Add missing opening brackets at the beginning
        }


        try {
            let data = JSON.parse(text);
            if (!Array.isArray(data)) throw new Error("Data is not an array");
            data = filterValidBalloonData(data); // Remove invalid triplets
            return data.length > 0 ? data : null; // Return null if no valid data remains
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
    return data.filter(entry =>
        Array.isArray(entry) &&
        entry.length === 3 &&
        entry.every(coord => typeof coord === 'number' && !isNaN(coord))
    );
}

async function fetchFullFlightHistory() {
    const history = [];
    const missingHours = [];  // Array to track missing hours
    for (let i = 0; i <= 23; i++) {
        const data = await fetchBalloonData(i);
        if (data) {
            history.push({ hoursAgo: i, data });
        } else {
            missingHours.push(i);  // Store the missing hour
        }
    }
    console.log("Flight history:", history);
    console.log("Missing hours:", missingHours);  // Log missing hours

    // Save to a JSON file
    const outputData = {
        history,
        missingHours
    };

    const filePath = './data/flight_history.json';  // Define the output file path
    try {
        fs.writeFileSync(filePath, JSON.stringify(outputData, null, 2));  // Write data to file
        console.log(`Data successfully saved to ${filePath}`);
    } catch (err) {
        console.error('Error saving data to file:', err);
    }

    return { history, missingHours };
}

fetchFullFlightHistory();



