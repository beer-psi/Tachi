import { IsNullish } from "util/misc";
import React from "react";
import {
	COLOUR_SET,
	ChartDocument,
	GPTStrings,
	PBScoreDocument,
	ScoreDocument,
} from "tachi-common";

export default function ArcaeaJudgementCell({
	score,
	chart,
}: {
	score: ScoreDocument<GPTStrings["arcaea"]> | PBScoreDocument<GPTStrings["arcaea"]>;
	chart: ChartDocument<GPTStrings["arcaea"]>;
}) {
	// even if we dont have judgement data, we know what they got.
	if (score.scoreData.lamp === "PURE MEMORY") {
		return (
			<td>
				<strong>
					<span style={{ color: COLOUR_SET.vibrantBlue }}>{chart.data.notecount}</span>-
					<span style={{ color: COLOUR_SET.vibrantYellow }}>0</span>-
					<span style={{ color: COLOUR_SET.red }}>0</span>
				</strong>
				<br />
				{chart.data.notecount ? (
					<small>
						[MAX-{chart.data.notecount - (score.scoreData.score - 10_000_000)}]
					</small>
				) : (
					<small>[+{score.scoreData.score - 10_000_000}]</small>
				)}
			</td>
		);
	}

	const judgements = score.scoreData.judgements;

	if (IsNullish(judgements.pure) || IsNullish(judgements.far) || IsNullish(judgements.lost)) {
		return <td>No Data.</td>;
	}

	return (
		<td>
			<strong>
				<span style={{ color: COLOUR_SET.vibrantBlue }}>{judgements.pure}</span>-
				<span style={{ color: COLOUR_SET.vibrantYellow }}>{judgements.far}</span>-
				<span style={{ color: COLOUR_SET.red }}>{judgements.lost}</span>
			</strong>
			{typeof score.scoreData.optional.shinyPure === "number" && (
				<>
					<br />
					<small>[+{score.scoreData.optional.shinyPure}]</small>
				</>
			)}
		</td>
	);
}
