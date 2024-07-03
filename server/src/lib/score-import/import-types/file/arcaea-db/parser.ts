import { KtLogger } from "lib/logger/logger";
import Database from "better-sqlite3";
import ScoreImportFatalError from "lib/score-import/framework/score-importing/score-import-error";
import { ArcaeaScoreRow } from "./types";
import { ParserFunctionReturns } from "../../common/types";
import { EmptyObject } from "utils/types";
import { p, PrudenceSchema } from "prudence";
import { FormatPrError } from "tachi-common";

const PR_ARCAEA_DB: PrudenceSchema = {
    scores: [
        {
            score: p.isPositiveInteger,
            shinyPerfectCount: p.isPositiveInteger,
            perfectCount: p.isPositiveInteger,
            nearCount: p.isPositiveInteger,
            missCount: p.isPositiveInteger,
            date: p.isPositiveInteger,
            songId: "string",
            songDifficulty: p.isBetween(0, 4),
    
            // -1 for hard gauge fails, 125 for Arghena's special course.
            health: p.isBetween(-1, 125),
    
            // 0: Touch, 1: Controller
            controllerType: p.isIn(0, 1),
    
            // LOST, CLEAR, FULL RECALL, PURE MEMORY, EASY CLEAR, HARD CLEAR
            clearType: p.isBetween(0, 5),
        }    
    ],
};

export function ParseArcaeaDB(
    fileData: Express.Multer.File,
    body: Record<string, unknown>,
    logger: KtLogger
): ParserFunctionReturns<ArcaeaScoreRow, EmptyObject> {
    const db = new Database(fileData.buffer);

    let versionRow: unknown;
    try {
        versionRow = db.prepare("SELECT appliedVersion from schemaversion").get();
    } catch (err) {
        throw new ScoreImportFatalError(400, `Could not query database version: ${(err as Error).message}`);
    }
    
    if (!versionRow) {
        throw new ScoreImportFatalError(400, "Invalid DB: Missing schema version.");
    }

    const dbVersion = (versionRow as { appliedVersion: unknown }).appliedVersion;

    if (dbVersion !== 4) {
        throw new ScoreImportFatalError(
            400,
            `The version of the DB is ${dbVersion}, which is not what the importer supports (4).`,
        );
    }

    let scores: unknown[];
    try {
        scores = db
            .prepare(`
                SELECT
                    scores.score,
                    scores.shinyPerfectCount,
                    scores.perfectCount,
                    scores.nearCount,
                    scores.missCount,
                    scores.date,
                    scores.songId,
                    scores.songDifficulty,
                    scores.health,
                    scores.ct as controllerType,
                    cleartypes.clearType
                FROM scores
                JOIN cleartypes 
                ON
                    scores.songId = cleartypes.songId
                    AND scores.songDifficulty = cleartypes.songDifficulty
                    AND scores.ct = cleartypes.ct
            `)
            .all();
    } catch (err) {
        throw new ScoreImportFatalError(400, `Could not get scores from the DB: ${(err as Error).message}`);
    }

    const err = p({ scores }, PR_ARCAEA_DB, {}, { allowExcessKeys: true });

    if (err) {
        throw new ScoreImportFatalError(400, FormatPrError(err, "Invalid DB"));
    }

    return {
        classProvider: null,
        context: {},
        iterable: scores as Array<ArcaeaScoreRow>,
        game: "arcaea",
    }
}
