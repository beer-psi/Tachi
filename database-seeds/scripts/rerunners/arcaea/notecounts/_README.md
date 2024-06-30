Notecounts are counted using [ArcaeaChartNoteCounterCSV](https://github.com/Lolitania/ArcaeaChartNoteCounterLibrary/releases/latest)
because I'm too lazy to reimplement an AFF parser and the only one available on NPM
can't be used due to ES modules shenanigans.

First, use `copy-aff.ts` to copy all charts to the expected structure:
```
ts-node copy-aff.ts -b cb -d dl
```

This will place AFFs under the `charts` directory. Then, copy `ArcaeaChartNoteCounterCSV.exe`
and `ArcaeaChartNoteCounterLibrary.dll` into that directory, then run the tool. Notecounts
will be placed into a `result.csv` file. Use `merge-notecounts.ts` to consume the CSV:

```
ts-node merge-notecounts.ts charts/result.csv
```

Linux TBD.
