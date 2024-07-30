import { copyFileSync, existsSync, mkdir, mkdirSync, readdirSync, statSync } from "fs";
import { Command } from "commander";
import path from "path";

const program = new Command()
	.requiredOption("-b, --bundle <cb>")
	.requiredOption("-d, --download <dl>")
	.option("-o, --output <dir>")
	.parse(process.argv);
const options = program.opts();
const output = options.output ?? path.join(__dirname, "charts");

if (!existsSync(output)) {
	mkdirSync(output);
}

const songsDirectory = path.join(options.bundle, "active", "songs");

for (const id of readdirSync(songsDirectory)) {
	const dir = path.join(songsDirectory, id);

	if (id.startsWith("dl_") || statSync(dir).isFile()) {
		continue;
	}

	const target = path.join(output, id);

	if (!existsSync(target)) {
		mkdirSync(target);
	}

	for (const file of readdirSync(dir)) {
		if (!file.endsWith(".aff")) {
			continue;
		}

		copyFileSync(path.join(songsDirectory, id, file), path.join(target, file));
	}
}

for (const file of readdirSync(options.download)) {
	if (!/^[a-z]+_\d/u.test(file)) {
		continue;
	}

	const [id, difficulty] = file.split("_") as [string, string];
	const target = path.join(output, id);

	if (!existsSync(target)) {
		mkdirSync(target);
	}

	copyFileSync(path.join(options.download, file), path.join(target, `${difficulty}.aff`));
}
