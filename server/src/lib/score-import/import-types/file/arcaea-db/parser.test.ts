import CreateLogCtx from "lib/logger/logger";
import t from "tap";
import { MockMulterFile } from "test-utils/mock-multer";
import { TestingArcaeaDB } from "test-utils/test-data";
import { ParseArcaeaDB } from "./parser";
import { ArcaeaScoreRow } from "./types";
import Database from "better-sqlite3";
import ScoreImportFatalError from "lib/score-import/framework/score-importing/score-import-error";
import { integer } from "tachi-common";

const logger = CreateLogCtx(__filename);

t.test("#ParseArcaeaDB", (t) => {
    t.test("Valid local DB", (t) => {
        const file = MockMulterFile(TestingArcaeaDB, "st3");
        const { iterable, game } = ParseArcaeaDB(file, {}, logger);

        t.equal(game, "arcaea");

        const iterableData = iterable as Array<ArcaeaScoreRow>;

        t.equal(iterableData.length, 326);
        
        t.end();
    });

    t.test("Broken DB: Missing schema version table", (t) => {
        const db = new Database(TestingArcaeaDB);
        
        db.prepare("DROP TABLE schemaversion").run();

        const file = MockMulterFile(db.serialize(), "st3");

        t.throws(
            () => ParseArcaeaDB(file, {}, logger),
            new ScoreImportFatalError(400, "Could not query database version: no such table: schemaversion"),
        );

        t.end();
    });

    t.test("Broken DB: Missing schema version row", (t) => {
        const db = new Database(TestingArcaeaDB);

        db.prepare("DELETE FROM schemaversion").run();

        const file = MockMulterFile(db.serialize(), "st3");

        t.throws(
            () => ParseArcaeaDB(file, {}, logger),
            new ScoreImportFatalError(400, "Invalid DB: Missing schema version."),
        );

        t.end();
    });

    t.test("Broken DB: Unsupported schema version", (t) => {
        const db = new Database(TestingArcaeaDB);

        db.prepare("UPDATE schemaversion SET appliedVersion = 'abc'").run();

        const file = MockMulterFile(db.serialize(), "st3");

        t.throws(
            () => ParseArcaeaDB(file, {}, logger),
            new ScoreImportFatalError(
                400,
                "The version of the DB is abc, which is not what the importer supports (4).",
            ),
        );

        t.end();
    });

    t.test("Broken DB: Missing scores table", (t) => {
        const db = new Database(TestingArcaeaDB);

        db.prepare("DROP TABLE scores").run();

        const file = MockMulterFile(db.serialize(), "st3");

        t.throws(
            () => ParseArcaeaDB(file, {}, logger),
            new ScoreImportFatalError(
                400,
                "Could not get scores from the DB: no such table: scores",
            ),
        );

        t.end();
    });

    t.test("Broken DB: Invalid data", (t) => {
        const db = new Database(TestingArcaeaDB);

        const row = db.prepare("SELECT * FROM scores LIMIT 1").get() as {
            id: integer,
            songDifficulty: integer,
            songId: string,
            ct: integer,
        };
        
        db
            .prepare("UPDATE scores SET songDifficulty = 5 WHERE id = ?")
            .run([row.id]);
        db
            .prepare("UPDATE cleartypes SET songDifficulty = 5 WHERE songDifficulty = ? AND songId = ? and ct = ?")
            .run([row.songDifficulty, row.songId, row.ct]);

        const file = MockMulterFile(db.serialize(), "st3");

        t.throws(
            () => ParseArcaeaDB(file, {}, logger),
            new ScoreImportFatalError(
                400,
                "Invalid DB: scores[0].songDifficulty | Expected a number between 0 and 4. | Received 5 [number].",
            ),
        );

        t.end();
    });

    t.end();
});
