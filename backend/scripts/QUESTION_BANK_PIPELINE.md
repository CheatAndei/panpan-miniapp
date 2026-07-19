# Panpan question-bank pipeline

This pipeline keeps the teacher's source directory read-only. Intermediate PDFs and logs go to `z-rubbish/panpan-question-bank`; the selected choice-question images go to `backend/resources/choice-king`, and the last fill-in plus last two subjective questions from each verified paper go to `backend/resources/weekly-challenges`.

## One-command build

Run from Windows PowerShell with WPS Office installed:

```powershell
& .\teach\panpan\backend\scripts\run-question-bank-pipeline.ps1 `
  -SourceRoot 'E:\teach\2026春季\广州7上数学' `
  -Count 1000 `
  -RecentCount 500 `
  -RecentFrom 2024
```

The first stage starts one hidden WPS COM instance and exports every original/analysis DOCX pair to PDF. Valid existing PDFs are skipped, each result is checked for a `%PDF-` header, and progress is appended to `export-state.jsonl`. A failed document is retried once with a fresh WPS instance and then quarantined as an error; the pipeline continues so the verified pairs can still be built. Pass `-Strict` to the export-only command when any missing or failed document should return a non-zero exit code.

The second stage reads answers only from analysis PDFs, finds A-D question boundaries in the original PDFs, and crops the original page region to WebP. It selects 500 questions from papers with a verified year of 2024 or later and 500 from verified 2020–2023 papers, deduplicates content, and distributes selections across papers with deterministic round-robin sampling. Papers without a reliable year are quarantined instead of being counted as “older”.

The final stage builds the terminal challenge in bulk. The same paper may contribute its final fill-in question and its final two subjective questions. Student question images are cropped from the original paper; teacher-only answer images and text come from the matching analysis PDF. Crops are stored as high-quality WebP to keep the deploy image and teacher downloads compact.

Low-confidence parsing, missing pairs, duplicates, and render failures are written to `build-review.json`; they are never added to `manifest.json`. If a selected crop fails to render, the builder automatically takes the next verified question from the same recent/older bucket so the 500/500 split remains exact.

## Useful partial commands

Export or resume PDFs:

```powershell
& .\teach\panpan\backend\scripts\export-wps-pdf-batch.ps1 `
  -SourceRoot 'E:\teach\2026春季\广州7上数学' `
  -Mode both `
  -OutputRoot '.\z-rubbish\panpan-question-bank\pdfs'
```

Scan without writing question images:

```powershell
$python = "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
& $python .\teach\panpan\backend\scripts\build-choice-king-bank.py `
  --pdf-root .\z-rubbish\panpan-question-bank\pdfs `
  --output .\teach\panpan\backend\resources\choice-king `
  --dry-run
```

Verify exact counts, every image, and generate evenly distributed visual-QA contact sheets:

```powershell
& $python .\teach\panpan\backend\scripts\verify-question-bank.py `
  --choice-root .\teach\panpan\backend\resources\choice-king `
  --terminal-root .\teach\panpan\backend\resources\weekly-challenges `
  --contact-output .\z-rubbish\panpan-question-bank\contact-sheets
```
