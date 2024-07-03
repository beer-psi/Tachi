import { integer } from "tachi-common";

export interface ArcaeaScoreRow {
    score: integer;
    shinyPerfectCount: integer;
    perfectCount: integer;
    nearCount: integer;
    missCount: integer;
    date: integer;
    songId: string;
    songDifficulty: 0 | 1 | 2 | 3 | 4;
    health: integer;
    controllerType: 0 | 1;
    clearType: 0 | 1 | 2 | 3 | 4 | 5;
}
