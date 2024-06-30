/**
 * result.csv is generated using ArcaeaChartNoteCounterCSV, which can be obtained
 * here: https://github.com/Lolitania/ArcaeaChartNoteCounterLibrary/releases/latest
 * 
 * to use, put charts in this exact structure:
 * Root
 * - ArcaeaChartNoteCounterCSV.exe
 * - ArcaeaChartNoteCounterLibrary.dll
 * - {inGameStrID}
 *   - 0.aff
 *   - 1.aff
 *   - 2.aff
 */

import fs from "fs";
import { ChartDocument } from "tachi-common";
import { Command } from "commander";
import { parse } from "csv-parse/sync";
import { ReadCollection, WriteCollection } from "../../../util";

const BLACKLISTED_IDS = [
    "ifirmx",
    "ifirmxrmx",
    "ignotusafterburn",
    "mismal",
    "overdead",
    "redandblueandgreen",
    "singularityvvvip",
    "tutorial",
    "hivemindrmx",
]

const program = new Command()
    .argument("<result.csv>")
    .parse(process.argv);
const csv: string[][] = parse(fs.readFileSync(program.args[0]!));
const charts: ChartDocument<"arcaea:Touch">[] = ReadCollection("charts-arcaea.json");
const chartMap = new Map<string, ChartDocument<"arcaea:Touch">>(charts.map((c) => [`${c.data.inGameStrID}-${c.difficulty}`, c]));

for (let row = 1; row < csv.length - 2; row++) {
    const [inGameStrID, pst, prs, ftr, byd, etr] = csv[row] as [string, string, string, string, string, string];

    if (BLACKLISTED_IDS.includes(inGameStrID)) {
        continue;
    }

    const pairs = {
        "Past": pst,
        "Present": prs,
        "Future": ftr,
        "Beyond": byd,
        "Eternal": etr,
    };

    for (const [difficulty, notecount] of Object.entries(pairs)) {
        if (!notecount || notecount === "0") {
            continue;
        }

        const chart = chartMap.get(`${inGameStrID}-${difficulty}`);

        if (!chart) {
            console.warn(`Missing chart for inGameStrID ${inGameStrID} [${difficulty}]`);
            continue;
        }

        chart.data.notecount = Number(notecount);
    }
}

WriteCollection("charts-arcaea.json", charts);
