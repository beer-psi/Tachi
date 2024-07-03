import { EmptyObject } from "utils/types";
import { ConverterFunction } from "../../common/types";
import { ArcaeaScoreRow } from "./types";
import db from "external/mongo/db";
import { Difficulties, GPTStrings, Playtypes, integer } from "tachi-common";
import { InternalFailure, InvalidScoreFailure, SongOrChartNotFoundFailure } from "lib/score-import/framework/common/converter-failures";
import { DryScore } from "lib/score-import/framework/common/types";
import { GetEnumValue } from "tachi-common/types/metrics";

function ConvertDifficulty(difficulty: ArcaeaScoreRow["songDifficulty"]): Difficulties[GPTStrings["arcaea"]] {
    switch (difficulty) {
        case 0:
            return "Past";
        case 1:
            return "Present";
        case 2:
            return "Future";
        case 3:
            return "Beyond";
        case 4:
            return "Eternal";
        default:
            throw new InvalidScoreFailure(`Invalid difficulty ${difficulty}.`);
    }
}

function ConvertPlaytype(playtype: ArcaeaScoreRow["controllerType"]): Playtypes["arcaea"] {
    switch (playtype) {
        case 0:
            return "Touch";
        case 1:
            return "Controller";
        default:
            throw new InvalidScoreFailure(`Invalid controller type ${playtype}.`);
    }
}

function ConvertLamp(score: ArcaeaScoreRow): GetEnumValue<GPTStrings["arcaea"], "lamp"> {
    switch (score.clearType) {
        case 0:
            return "LOST";
        case 1:
            return "CLEAR";
        case 2:
            // `clearType` stores the best cleartype achieved, but judgements
            // are from the best score. Thus it is possble for scores of this
            // clearType to have misses.
            if (score.missCount === 0) {
                return "FULL RECALL";
            }
            return "CLEAR";
        case 3:
            return "PURE MEMORY";
        case 4:
            return "EASY CLEAR";
        case 5:
            return "HARD CLEAR";
        default:
            throw new InvalidScoreFailure(`Invalid clearType of ${score.clearType}.`);
    }
}

// The DB stores timestamps to varying degrees of precision:
// - 10 digits (precise to the second)
// - 7 digits (can be off by up to 17 minutes)
// - 4 digits
// - 1 digit
// We accept the first two cases but not the two latter.
function ParseTimeAchieved(timestamp: integer): integer | null {
    const numberOfDigits = timestamp.toString().length;

    if (numberOfDigits >= 10) {
        return timestamp * 1000;
    }

    if (numberOfDigits === 7) {
        return timestamp * 1000000;
    }

    return null;
}

export const ConvertArcaeaDB: ConverterFunction<ArcaeaScoreRow, EmptyObject> = async (
    data,
    context,
    importType,
    logger,
) => {
    const difficulty = ConvertDifficulty(data.songDifficulty);
    const playtype = ConvertPlaytype(data.controllerType);
    const chart = await db.anyCharts["arcaea"].findOne({
        "data.inGameStrID": data.songId,
        playtype,
        difficulty,
    });

    if (!chart) {
        throw new SongOrChartNotFoundFailure(
            `Could not find chart with inGameStrID ${data.songId}.`,
            importType,
            data,
            context,
        );
    }

    const song = await db.anySongs["arcaea"].findOne({ id: chart.songID });

    if (!song) {
        logger.severe(`Song-Chart desync on ${chart.songID}.`);

        throw new InternalFailure("Failed to get the song for a chart that exists.");
    }

    const lamp = ConvertLamp(data);
    const timeAchieved = ParseTimeAchieved(data.date);    
    
    const dryScore: DryScore<GPTStrings["arcaea"]> = {
        game: "arcaea",
        comment: null,
        importType,
        service: "Arcaea Local DB",
        scoreData: {
            score: data.score,
            lamp,
            judgements: {
                pure: data.perfectCount,
                far: data.nearCount,
                lost: data.missCount,
            },
            optional: {
                shinyPure: data.shinyPerfectCount,
                // The gauge in an Arcaea DB goes down to -1 if you fail early on hard gauge.
                gauge: Math.max(0, data.health)
            }
        },
        scoreMeta: {},
        timeAchieved,
    };

    return { dryScore, chart, song };
};
