import { GoalFmtScore, GoalOutOfFmtScore, GradeGoalFormatter } from "./_common";
import { CreatePBMergeFor } from "game-implementations/utils/pb-merge";
import { ProfileAvgBestN } from "game-implementations/utils/profile-calc";
import { SessionAvgBest10For } from "game-implementations/utils/session-calc";
import { Potential } from "rg-stats";
import { ARCAEA_GBOUNDARIES, FmtNum, GetGrade } from "tachi-common";
import { IsNullish } from "utils/misc";
import type { GPTServerImplementation } from "game-implementations/types";
import type { GPTStrings } from "tachi-common";

const ARCAEA_IMPL: GPTServerImplementation<GPTStrings["arcaea"]> = {
	chartSpecificValidators: {
		score: (score, chart) => {
			if (score < 0) {
				return `Score must be non-negative. Got ${score}`;
			}

			if (score > 10_000_000 + chart.data.notecount) {
				return `Score cannot exceed ${10_000_000 + chart.data.notecount} for this chart.`;
			}

			return true;
		},
		shinyPure: (shinyPure, chart) => {
			if (shinyPure > chart.data.notecount) {
				return `The number of shiny PUREs cannot exceed ${chart.data.notecount} for this chart.`;
			}

			return true;
		}
	},
	derivers: {
		grade: ({ score }) => GetGrade(ARCAEA_GBOUNDARIES, score),
	},
	scoreCalcs: {
		potential: (scoreData, chart) => Potential.calculate(scoreData.score, chart.levelNum),
	},
	sessionCalcs: {
		naivePotential: SessionAvgBest10For("potential"),
	},
	profileCalcs: {
		naivePotential: ProfileAvgBestN("potential", 30),
	},
	classDerivers: {
		badge: (ratings) => {
			const potential = ratings.naivePotential;

			if (IsNullish(potential)) {
				return null;
			}

			if (potential >= 13.0) {
				return "THREE_STARS";
			} else if (potential >= 12.5) {
				return "TWO_STARS";
			} else if (potential >= 12.0) {
				return "ONE_STAR";
			} else if (potential >= 11.0) {
				return "RED";
			} else if (potential >= 10.0) {
				return "PURPLE";
			} else if (potential >= 7.0) {
				return "ASH_PURPLE";
			} else if (potential >= 3.5) {
				return "GREEN";
			}

			return "BLUE";
		},
	},
	goalCriteriaFormatters: {
		score: GoalFmtScore,
	},
	goalProgressFormatters: {
		score: (pb) => FmtNum(pb.scoreData.score),
		lamp: (pb) => pb.scoreData.lamp,
		grade: (pb, gradeIndex) =>
			GradeGoalFormatter(
				ARCAEA_GBOUNDARIES,
				pb.scoreData.grade,
				pb.scoreData.score,
				ARCAEA_GBOUNDARIES[gradeIndex]!.name
			),
	},
	goalOutOfFormatters: {
		score: GoalOutOfFmtScore,
	},
	pbMergeFunctions: [
		CreatePBMergeFor("largest", "enumIndexes.lamp", "Best Lamp", (base, score) => {
			base.scoreData.lamp = score.scoreData.lamp;
		}),
	],
	defaultMergeRefName: "Best Score",
	scoreValidators: [
		(s) => {
			if (s.scoreData.lamp === "PURE MEMORY" && s.scoreData.score < 10_000_000) {
				return `PURE MEMORY scores must have a score larger than 10 million. Got ${s.scoreData.score} instead.`;
			}

			// This doesn't go both ways. Due to how Arcaea scoring works, you can technically
			// achieve a score of 10 million without a PM, if the chart's notecount is high enough.
			//
			// For example, if a chart has 2237 notes, 2236 shiny PUREs + 1 FAR gives a score of
			// exactly 10 million (2236.5 * 10_000_000 / 2237 + 2236 = 10_000_000).
		},
		(s) => {
			// 1 FAR is half the value of 1 PURE.
			// The minimum score for a FULL RECALL is an all-FAR FULL RECALL, or
			// 10_000_000 / 2 = 5_000_000.
			if (s.scoreData.lamp === "FULL RECALL" && s.scoreData.score < 5_000_000) {
				return `FULL RECALL scores must have a score larger than 5 million. Got ${s.scoreData.score} instead.`;
			}
		},
		(s) => {
			const { far, lost } = s.scoreData.judgements;

			if (s.scoreData.lamp === "PURE MEMORY" && (lost ?? 0) + (far ?? 0) > 0) {
				return "Cannot have a PURE MEMORY with any fars or losts.";
			} else if (s.scoreData.lamp === "FULL RECALL" && (lost ?? 0) > 0) {
				return "Cannot have a FULL RECALL with non-zero lost count.";
			}
		},
		(s) => {
			const shinyPure = s.scoreData.optional.shinyPure;
			const pure = s.scoreData.judgements.pure;

			if (typeof shinyPure === "number" && typeof pure === "number" && shinyPure > pure) {
				return "Cannot have more shiny PUREs than PUREs.";
			}
		}
	],
};

export const ARCAEA_TOUCH_IMPL: GPTServerImplementation<"arcaea:Touch"> = ARCAEA_IMPL;
export const ARCAEA_CONTROLLER_IMPL: GPTServerImplementation<"arcaea:Controller"> = ARCAEA_IMPL;
