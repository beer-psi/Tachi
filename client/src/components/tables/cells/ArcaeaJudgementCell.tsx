import { IsNullish } from "util/misc";
import React from "react";
import { COLOUR_SET, ChartDocument, PBScoreDocument, ScoreDocument } from "tachi-common";

export default function ArcaeaJudgementCell({
	score,
	chart,
}: {
	score: ScoreDocument<"arcaea:Touch"> | PBScoreDocument<"arcaea:Touch">;
	chart: ChartDocument<"arcaea:Touch">
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
				[+{score.scoreData.score - 10_000_000}]
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
					[+{score.scoreData.optional.shinyPure}]
				</>
			)}
		</td>
	);
}
