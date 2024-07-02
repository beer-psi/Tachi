import { Difficulties, integer } from "tachi-common";

export function convertDifficulty(input: integer): Difficulties["arcaea:Touch"] {
	switch (input) {
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
	}

	throw new Error(
		`Unknown difficulty ${input}, can't convert this into one of Tachi's Arcaea difficulties. Consider updating the merge-songlist.ts script.`
	);
}
