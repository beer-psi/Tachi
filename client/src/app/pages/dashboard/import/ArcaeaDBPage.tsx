import ImportFileInfo from "components/imports/ImportFileInfo";
import useSetSubheader from "components/layout/header/useSetSubheader";
import Divider from "components/util/Divider";
import ExternalLink from "components/util/ExternalLink";
import React from "react";

export default function ArcaeaDBPage() {
	useSetSubheader(["Import Scores", "Arcaea Database"]);

	return (
		<div>
			<h2 className="text-center mb-4">Obtaining the database</h2>
			<ol className="instructions-list">
				<li>
					<strong>iOS:</strong> Create a full iTunes backup and use a tool such as
					<ExternalLink href="https://github.com/MaxiHuHe04/iTunes-Backup-Explorer">
						iTunes Backup Explorer
					</ExternalLink>
					and extracting <code>App Domain/moe.low.arc/Documents/st3</code>.
				</li>
				<li>
					<strong>Rooted Android:</strong> Extract <code>/data/data/moe.low.arc/files/st3</code>.
				</li>
				<li>
					<strong>Hacked Switch:</strong> Use a save manager such as
					<ExternalLink href="https://github.com/BernardoGiordano/Checkpoint/releases/latest">
						Checkpoint
					</ExternalLink>
					to dump <code>arcaea.db</code> from your Arcaea saves.
				</li>
			</ol>
			<Divider />
			<ImportFileInfo
				acceptMime={["application/x-sqlite3", ".db"]}
				importType="file/arcaea-db"
				name="Arcaea Database"
				parseFunction={(d: ArrayBuffer) => {
					return { valid: true, info: {} };
				}}
				fileType="RAW"
			/>
		</div>
	);
}
