# Vocabulary data sources and status

Word Hero's `data/vocabulary-3000.json` includes 3,000 entries with English headwords, Polish translations and CEFR labels.

- English words and CEFR labels: `Talhakasikci/cefr-vocabulary-dataset` (A1–C1) and `lratusa/wordmaster-wordlists` (C2). CEFR labels are indicative and have not been independently validated.
- Polish translations: FreeDict English–Polish Piotrowski + Saloni dictionary, from `freedict/fd-dictionaries` (https://freedict.org/), licensed under GNU Free Documentation License 1.2 or later for dictionary text. See original source for license and authorship.
- English definitions: where supplied by the CEFR source. Not all entries have definitions, and some definitions may be incorrect or represent different senses.
- Example sentences: available for a subset of C2 entries only. They have not been manually verified.

Counts: A1 300; A2 400; B1 450; B2 800; C1 700; C2 350. Total: 3,000.

The game falls back to Polish prompts when an English definition is unavailable. The entries are not a reviewed language-learning curriculum; proofreading and sense-level alignment are future work.

Raw candidate and FreeDict extraction files are included in `data/` for traceability.