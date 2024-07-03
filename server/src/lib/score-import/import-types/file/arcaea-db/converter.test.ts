import CreateLogCtx from "lib/logger/logger";
import t from "tap";
import ResetDBState from "test-utils/resets";
import { ConvertArcaeaDB } from "./converter";
import deepmerge from "deepmerge";
import { TestingArcaeaSheriruthFTR, TestingArcaeaSheriruthSong } from "test-utils/test-data";
import { ArcaeaScoreRow } from "./types";
import { DryScoreData } from "lib/score-import/framework/common/types";
import { GPTStrings } from "tachi-common";

const logger = CreateLogCtx(__filename);

const parsedScore = {
    score: 9992424,
    shinyPerfectCount: 1113,
    perfectCount: 1150,
    nearCount: 0,
    missCount: 1,
    date: 1676726,
    songId: "sheriruth",
    songDifficulty: 2,
    health: 100,
    controllerType: 0,
    clearType: 5,
};

t.test("#ConvertArcaeaDB", (t) => {
    t.beforeEach(ResetDBState);

    function conv(g: Record<string, unknown> = {}) {
        return ConvertArcaeaDB(
            deepmerge(parsedScore, g) as unknown as ArcaeaScoreRow,
            {},
            "file/arcaea-db",
            logger
        );
    }

    t.test("Should return a dryScore on valid input.", async (t) => {
        const res = await conv();

        t.hasStrict(res, {
            song: TestingArcaeaSheriruthSong,
            chart: TestingArcaeaSheriruthFTR,
            dryScore: {
                game: "arcaea",
                comment: null,
                importType: "file/arcaea-db",
                service: "Arcaea Local DB",
                scoreData: {
                    score: 9992424,
                    lamp: "HARD CLEAR",
                    judgements: {
                        pure: 1150,
                        far: 0,
                        lost: 1,
                    },
                    optional: {
                        shinyPure: 1113,
                        gauge: 100,
                    },
                },
                scoreMeta: {},
                timeAchieved: 1676726000000,
            },
        });

        t.end();
    });

    t.test("Should coerce FULL RECALL back to CLEAR if there's a miss.", async (t) => {
        const res = await conv({ clearType: 2 });

        t.equal((res.dryScore.scoreData as DryScoreData<GPTStrings["arcaea"]>).lamp, "CLEAR");
        t.end();
    });

    t.test("Should coerce gauge back to 0 when failing on hard gauge.", async (t) => {
        const res = await conv({ health: -1 });
        
        t.equal((res.dryScore.scoreData as DryScoreData<GPTStrings["arcaea"]>).optional.gauge, 0);
        t.end();
    })

    t.test("Should ignore short timestamps.", async (t) => {
        const res = await conv({ date: 1234 });
        
        t.equal(res.dryScore.timeAchieved, null);
        t.end();
    });

    t.test("Should reject invalid difficulty.", async (t) => {
        t.rejects(() => conv({ songDifficulty: 5 }), {
            message: /Invalid difficulty 5\./u,
        });

        t.end();
    });

    t.test("Should reject invalid clear type.", async (t) => {
        t.rejects(() => conv({ clearType: 6 }), {
            message: /Invalid clearType of 6\./u,
        });

        t.end();
    });

    t.test("Should reject invalid controller type.", async (t) => {
        t.rejects(() => conv({ controllerType: 2 }), {
            message: /Invalid controller type 2\./u,
        });

        t.end();
    });

    t.test("Should throw SongOrChartNotFound on unknown songId.", async (t) => {
        t.rejects(() => conv({ songId: "invalid" }), {
            message: /Could not find chart with inGameStrID invalid\./u,
        });
        
        t.end();
    });

    t.end();
});
