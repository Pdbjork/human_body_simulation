/**
 * Simple parser for Apple Health XML exports.
 * Extracts Resting Heart Rate and recent Step Counts.
 */
export class HealthParser {
    constructor() {
        this.parser = new DOMParser();
    }

    /**
     * Parse the standard export.xml file string.
     * @param {string} xmlString 
     * @returns {Object} Parsed health data
     */
    parse(xmlString) {
        const xmlDoc = this.parser.parseFromString(xmlString, "text/xml");
        const records = xmlDoc.getElementsByTagName("Record");

        const data = {
            restingHeartRate: null,
            averageSteps: 0,
            recordCount: records.length
        };

        let totalSteps = 0;
        let stepDays = new Set();
        let rhrSum = 0;
        let rhrCount = 0;

        // Iterate backwards (newest first usually) or check dates
        // For prototype, we scan all, but really should limit to last N days
        for (let i = 0; i < records.length; i++) {
            const type = records[i].getAttribute("type");
            const value = records[i].getAttribute("value");
            const date = records[i].getAttribute("startDate");

            if (!value) continue;

            if (type === "HKQuantityTypeIdentifierRestingHeartRate") {
                rhrSum += parseFloat(value);
                rhrCount++;
            } else if (type === "HKQuantityTypeIdentifierStepCount") {
                totalSteps += parseInt(value);
                if (date) stepDays.add(date.split(' ')[0]); // YYYY-MM-DD
            }
        }

        if (rhrCount > 0) {
            data.restingHeartRate = Math.round(rhrSum / rhrCount);
        }

        if (stepDays.size > 0) {
            data.averageSteps = Math.round(totalSteps / stepDays.size);
        }

        return data;
    }
}
