import fs from "fs";
import { ChartDocument, GPTStrings, Playtypes, SongDocument, Versions, integer } from "tachi-common";
import {
	CreateChartID,
	GetFreshSongIDGenerator,
	ReadCollection,
	WriteCollection,
} from "../../util";
import { Command } from "commander";
import fjsh from "fast-json-stable-hash";
import { CreateLogger } from "mei-logger";
import { convertDifficulty } from "./_common";

const logger = CreateLogger("arcaea/merge-songlist");

type LocalizedText = { en: string } & Record<string, string>;
type LocalizedSearchTerms = Record<string, Array<string>>;

interface SonglistChart {
	ratingClass: 0 | 1 | 2 | 3 | 4;
	title_localized?: LocalizedText;
	artist?: string;
	audioOverride?: boolean;
	rating: number;
	ratingPlus?: boolean;
	version?: string;
	hidden_until_unlocked?: boolean;
	hidden_until?: "always" | "difficulty" | "none" | "song";
}

interface SonglistEntry {
	idx: integer;
	id: string;
	title_localized: LocalizedText;
	artist: string;
	set: string;
	search_title?: LocalizedSearchTerms;
	search_artist?: LocalizedSearchTerms;
	version: string;
	difficulties: Array<SonglistChart>;
}

interface PacklistEntry {
	id: string;
	pack_parent?: string;
	name_localized: LocalizedText;
	description_localized: LocalizedText;
}

/**
 * Type added to support having one key correspond to multiple values,
 * since Arcaea likes to use the same ID for two different songs for their
 * Beyond charts.
 */
class MultiMapUniqueValues<K, V> {
	private map: Map<K, Array<V>>;
	private hashMap: Map<K, Array<string>>;

	constructor(iterable?: Iterable<readonly [K, V]> | null | undefined) {
		this.map = new Map();
		this.hashMap = new Map();
		if (iterable) {
			for (const pair of iterable) {
				this.set(pair[0], pair[1]);
			}
		}
	}

	get(key: K) {
		return this.map.get(key);
	}

	set(key: K, value: V) {
		const valueHash = fjsh.hash(value, "SHA256");
		const existingHashes = this.hashMap.get(key);
		if (!existingHashes) {
			this.map.set(key, [value]);
			this.hashMap.set(key, [valueHash]);
			return this;
		}

		if (existingHashes.includes(valueHash)) {
			return this;
		}

		const existingEntries = this.get(key) ?? [];
		existingEntries.push(value);
		existingHashes.push(valueHash);
		this.map.set(key, existingEntries);
		this.hashMap.set(key, existingHashes);

		return this;
	}
}

function convertPackName(packsByID: Record<string, PacklistEntry>, packID: string) {
	if (packID === "single") {
		return "Memory Archive";
	}

	const pack = packsByID[packID];

	if (!pack) {
		throw new Error(
			`Unknown pack ${packID}, can't convert this into a pack name. Check your "packlist".`
		);
	}

	if (pack.pack_parent) {
		let parentName: string;

		if (pack.pack_parent === "single") {
			parentName = "Memory Archive";
		} else {
			const parentPack = packsByID[pack.pack_parent];
			
			if (!parentPack) {
				throw new Error(
					`${packID} declares parent ${pack.pack_parent}, but no packs with such ID exists. Check your "packlist".`
				);
			}

			parentName = parentPack.name_localized.en;
		}
		
		return `${pack.name_localized.en} (${parentName})`;
	}

	return pack.name_localized.en;
}

const program = new Command()
	.requiredOption("-s, --songlist <songlist>")
	.requiredOption("-p, --packlist <packlist>")
	.requiredOption("-v, --version <mobile,switch>")
	.option("--apply-level-changes")
	.option("--force")
	.parse(process.argv);
const options = program.opts();

if (!["mobile", "switch"].includes(options.version)) {
	logger.error(`Invalid version ${options.version}. Expected one of "mobile", "switch".`);
	process.exit(1);
}

const version = options.version as Versions[GPTStrings["arcaea"]];

const content = fs.readFileSync(options.songlist, { encoding: "utf-8" });
const data: { songs: Array<SonglistEntry> } = JSON.parse(content);

const packlistContent = fs.readFileSync(options.packlist, { encoding: "utf-8" });
const packlistData: { packs: Array<PacklistEntry> } = JSON.parse(packlistContent);
const packsByID = Object.fromEntries(packlistData.packs.map((p) => [p.id, p]));

const existingSongDocs: SongDocument<"arcaea">[] = ReadCollection("songs-arcaea.json")
const existingSongs = new Map(
	existingSongDocs.map((e) => [e.id, e])
);
const songTitleMap = new Map(
	existingSongDocs.map((e) => [e.title, e])
);
const existingChartDocs: Array<ChartDocument<GPTStrings["arcaea"]>> = ReadCollection("charts-arcaea.json");
const inGameIDToSongsMap: MultiMapUniqueValues<string, SongDocument<"arcaea">> = new MultiMapUniqueValues();
const existingCharts: Map<string, ChartDocument<GPTStrings["arcaea"]>> = new Map();

for (const chart of existingChartDocs) {
	const song = existingSongs.get(chart.songID);
	
	if (!song) {
		logger.error(`DESYNC: Chart ${chart.songID} does not belong to any song!`);
		process.exit(1);
	}

	if (Array.isArray(chart.data.inGameStrID)) {
		for (const id of chart.data.inGameStrID) {
			inGameIDToSongsMap.set(id, song);
			existingCharts.set(`${id}-${chart.playtype}-${chart.difficulty}`, chart);
		}
	} else {
		inGameIDToSongsMap.set(chart.data.inGameStrID, song);
		existingCharts.set(`${chart.data.inGameStrID}-${chart.playtype}-${chart.difficulty}`, chart);
	}	
}

const getNewSongID = GetFreshSongIDGenerator("arcaea");

const newSongs: Array<SongDocument<"arcaea">> = [];
const newCharts: Array<ChartDocument<GPTStrings["arcaea"]>> = [];

for (const entry of data.songs) {
	const inGameStrID = entry.id;
	let possibleSongs = inGameIDToSongsMap.get(inGameStrID);
	const searchTerms = Object.values(entry.search_title ?? {})
		.flatMap((t) => t)
		// Necessary because some songs have blank search terms
		// e.g. qualia -ideaesthesia-
		.filter((t) => t);

	if (!possibleSongs) {
		const title = entry.title_localized.en;
		const titleAlreadyExists = songTitleMap.get(title);

		if (titleAlreadyExists) {
			logger.warn(
				`A song called ${title} already exists in songs-arcaea (songID ${titleAlreadyExists.id}). Is this a duplicate with a different inGameID?`,
			);

			if (!options.force) {
				logger.warn(
					`Must be resolved manually. Use --force to blindly overwrite it anyway.`
				);
				continue;
			}

			logger.warn(`--force provided, adding it to the DB anyway.`);
		}

		// Deduplicated because multiple languages might have the same alt titles
		const altTitles = [
			...new Set(Object.values(entry.title_localized).filter((t) => t !== title)),
		];

		const songDoc: SongDocument<"arcaea"> = {
			title,
			artist: entry.artist,
			altTitles,
			searchTerms,
			id: getNewSongID(),
			data: {
				displayVersion: entry.version,
				songPack: convertPackName(packsByID, entry.set),
			},
		};

		logger.info(`Inserting new song ${songDoc.artist} - ${songDoc.title} (inGameStrID ${inGameStrID}).`);

		possibleSongs = [songDoc];
		newSongs.push(songDoc);
		inGameIDToSongsMap.set(inGameStrID, songDoc);
	}

	for (const chart of entry.difficulties) {	
		if (chart.hidden_until_unlocked && chart.hidden_until === "always") {
			// Deactivated difficulty
			continue;
		}

		if (chart.rating === 0) {
			continue;
		}

		let song: SongDocument<"arcaea">;

		if (
			chart.audioOverride &&
			chart.title_localized &&
			!possibleSongs.some((t) => t.title === chart.title_localized?.en)
		) {
			// There are some songs (all BYD) that share the same set
			// with other songs.

			const title = chart.title_localized.en;
			const altTitles = [
				...new Set(Object.values(chart.title_localized).filter((t) => t !== title)),
			];

			const songDoc: SongDocument<"arcaea"> = {
				title,
				artist: chart.artist ?? entry.artist,
				altTitles,
				searchTerms,
				id: getNewSongID(),
				data: {
					displayVersion: chart.version ?? entry.version,
					songPack: convertPackName(packsByID, entry.set),
				},
			};

			logger.info(`Inserting new song ${songDoc.artist} - ${songDoc.title} (inGameStrID ${inGameStrID}).`);

			song = songDoc;
			newSongs.push(songDoc);
			inGameIDToSongsMap.set(inGameStrID, songDoc);
		} else {
			const title = chart.title_localized?.en ?? entry.title_localized.en;
			const possibleSong = possibleSongs.find((e) => e.title === title);

			if (!possibleSong) {
				logger.error(`No song with inGameStrID ${inGameStrID} matches title ${title}?`);
				continue;
			}

			song = possibleSong;
		}

		const difficulty = convertDifficulty(chart.ratingClass);
		const level = `${chart.rating}${chart.ratingPlus ? "+" : ""}`;
		const levelNum = chart.rating + (chart.ratingPlus ? 0.7 : 0);
		const playtypes: Playtypes["arcaea"][] = ["Touch"];

		if (version === "switch") {
			playtypes.push("Controller");
		}

		for (const playtype of playtypes) {
			const exists = existingCharts.get(`${inGameStrID}-${playtype}-${difficulty}`);

			if (exists) {
				if (exists.level !== level && options.applyLevelChanges) {
					logger.info(`Chart ${entry.artist} - ${entry.title_localized.en} [${playtype} ${difficulty}] has had a level change: ${exists.level} -> ${level}`);

					exists.level = level;
					exists.levelNum = levelNum;
				}
 				
				if (!exists.versions.includes(version)) {
					exists.versions.push(version);
				}

				continue;
			}

			const chartDoc: ChartDocument<GPTStrings["arcaea"]> = {
				chartID: CreateChartID(),
				songID: song.id,
				difficulty,
				isPrimary: true,
				level,
				levelNum,
				versions: [version],
				playtype,
				data: {
					inGameStrID,
					// Filled in later, but not by this script
					notecount: 0,
				},
			};

			newCharts.push(chartDoc);

			logger.info(`Inserted new chart ${entry.artist} - ${entry.title_localized.en} [${playtype} ${difficulty}].`);
		}
	}
}

WriteCollection("songs-arcaea.json", [...existingSongs.values(), ...newSongs]);
WriteCollection("charts-arcaea.json", [...existingChartDocs, ...newCharts]);
