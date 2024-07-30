import { Command } from "commander";
import fs from "fs";
import path from "path";
import { ChartDocument, GPTStrings } from "tachi-common";
import { ReadCollection, WriteCollection } from "../../util";
import { convertDifficulty } from "./_common";
import { CreateLogger } from "mei-logger";

interface SongInfo {
	difficulty: 0 | 1 | 2 | 3;
	song_id: string;
	rating: number;
}

const logger = CreateLogger("arcaea/merge-switch-local-data");
const program = new Command()
	.requiredOption("-d, --data <switch-local-xx-yy-zz>")
	.parse(process.argv);
const options = program.opts();

const existingChartDocs: Array<ChartDocument<GPTStrings["arcaea"]>> =
	ReadCollection("charts-arcaea.json");
const existingCharts = new Map(
	existingChartDocs.map((c) => [`${c.data.inGameStrID}-${c.playtype}-${c.difficulty}`, c])
);
const songs = JSON.parse(
	fs.readFileSync(path.join(options.data, "songs.json"), { encoding: "utf-8" })
) as SongInfo[];

for (const song of songs) {
	const difficulty = convertDifficulty(song.difficulty);

	// We usually only want to update the chart constants for the controller playtype.
	// If the Switch version ends up with some more exclusive songs, it is usually trivial to
	// update chart constants normally.
	const chart = existingCharts.get(`${song.song_id}-Controller-${difficulty}`);

	if (!chart) {
		logger.warn(`Missing chart ${song.song_id} [Controller ${difficulty}].`);
		continue;
	}

	if (chart.levelNum !== song.rating) {
		logger.info(
			`Chart ${song.song_id} [Controller ${difficulty}] has had a levelNum change: ${chart.levelNum} -> ${song.rating}`
		);
		chart.levelNum = song.rating;
	}
}

WriteCollection("charts-arcaea.json", existingChartDocs);
