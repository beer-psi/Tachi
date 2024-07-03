import ImportFileInfo from "components/imports/ImportFileInfo";
import useSetSubheader from "components/layout/header/useSetSubheader";
import React from "react";

export default function ArcaeaDBPage() {
	useSetSubheader(["Import Scores", "Arcaea Database"]);

	return (
		<ImportFileInfo
			acceptMime={["application/x-sqlite3", ".db"]}
			importType="file/arcaea-db"
			name="Arcaea Database"
			parseFunction={(d: string) => {
				return { valid: true, info: {} };
			}}
		/>
	);
}
