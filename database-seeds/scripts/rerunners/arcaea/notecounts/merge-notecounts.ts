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
import { ChartDocument, Difficulties, GPTStrings, Playtypes } from "tachi-common";
import { Command } from "commander";
import { parse } from "csv-parse/sync";
import { ReadCollection, WriteCollection } from "../../../util";
import { CreateLogger } from "mei-logger";

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

const logger = CreateLogger("arcaea/merge-notecounts");
const program = new Command()
    .argument("<result.csv>")
    .parse(process.argv);
const csv: string[][] = parse(fs.readFileSync(program.args[0]!));
const charts: ChartDocument<GPTStrings["arcaea"]>[] = ReadCollection("charts-arcaea.json");
const chartMap = new Map<string, ChartDocument<GPTStrings["arcaea"]>>();

for (const chart of charts) {
    if (Array.isArray(chart.data.inGameStrID)) {
        for (const igid of chart.data.inGameStrID) {
            chartMap.set(`${igid}-${chart.playtype}-${chart.difficulty}`, chart);
        }
    } else {
        chartMap.set(`${chart.data.inGameStrID}-${chart.playtype}-${chart.difficulty}`, chart);
    }
}

const header = csv[0];

if (!header) {
    logger.error("The CSV is missing the header.");
    process.exit(1);
}

for (let row = 1; row < csv.length - 2; row++) {
    let pairs: Partial<Record<Playtypes["arcaea"], Record<Difficulties[GPTStrings["arcaea"]], string>>>;
    let inGameStrID;

    if (header.length === 6) {
        const [igid, pst, prs, ftr, byd, etr] = csv[row] as [string, string, string, string, string, string];

        inGameStrID = igid;
        pairs = {
            "Touch": {
                "Past": pst,
                "Present": prs,
                "Future": ftr,
                "Beyond": byd,
                "Eternal": etr,
            },
        };
    } else {
        const [
            igid,
            pst,
            pstController,
            prs, 
            prsController,
            ftr,
            ftrController,
            byd,
            bydController,
            etr,
            etrController,
        ] = csv[row] as [string, string, string, string, string, string, string, string, string, string, string];

        inGameStrID = igid;
        pairs = {
            "Touch": {
                "Past": pst,
                "Present": prs,
                "Future": ftr,
                "Beyond": byd,
                "Eternal": etr,
            },
            "Controller": {
                "Past": pstController,
                "Present": prsController,
                "Future": ftrController,
                "Beyond": bydController,
                "Eternal": etrController,
            }
        };
    }

    if (BLACKLISTED_IDS.includes(inGameStrID)) {
        continue;
    }

    for (const [playtype, difficulties] of Object.entries(pairs)) {
        for (const [difficulty, notecount] of Object.entries(difficulties)) {
            let nc = notecount;

            if ((!nc || nc === "0") && playtype === "Controller") {
                nc = pairs["Touch"]![difficulty];
            }

            if (!nc || nc === "0") {
                // logger.warn(`No notecounts were found for ${inGameStrID}.`);
                continue;
            }

            const chart = chartMap.get(`${inGameStrID}-${playtype}-${difficulty}`);

            if (!chart) {
                logger.warn(`Missing chart for inGameStrID ${inGameStrID} [${playtype} ${difficulty}]`);
                continue;
            }

            if (chart.data.notecount !== 0 && chart.data.notecount !== Number(nc)) {
                logger.warn(`Chart ${inGameStrID} [${playtype} ${difficulty}] has a different notecount in database seeds. Did this chart change? OLD: ${chart.data.notecount} -> ${notecount}`);
                continue;
            }

            chart.data.notecount = Number(nc);
        }
    }
}

WriteCollection("charts-arcaea.json", charts);
