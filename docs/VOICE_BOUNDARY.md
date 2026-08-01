# Voice and Audio Boundary

The repository provides a provider-neutral reading representation. It does not select a text-to-speech vendor, call a model, generate audio, stream audio, or add an audio interface.

Each chapter has two generated forms:

- `reading.txt`: clean plain text in reading order;
- `reading.json`: title, hashes, word count, reading time, license information, audio boundary metadata, and ordered semantic segments.

Every segment has a durable ID. Headings use the chapter's stable section ID. Paragraphs, lists, quotations, tables, code examples, and semantic HTML components use stable passage IDs and name their containing section. This makes the representation suitable for a future streaming service without forcing the future service to infer boundaries from rendered HTML.

The baseline states:

```json
"audio": {
  "provider": null,
  "generated": false,
  "streamingReady": true
}
```

`streamingReady` means that stable ordered text segments exist. It does not claim that pronunciation, pacing, voice selection, caching, transcripts, captions, or accessibility have been tested.

After editing chapter prose, run `node scripts/generate-reading.mjs --chapter <slug> --write`. Existing markers survive; newly added semantic blocks receive new IDs. The generator refreshes the source and plain-text hashes so a future audio cache can invalidate only changed chapters or segments.

The JSON structure is original CC0 metadata, but each segment's prose remains CC BY 4.0. A future audio file would be a transformation of that prose and must retain the appropriate attribution.

Any future TTS implementation should preserve these boundaries:

- accept a chapter and ordered segment IDs, not arbitrary hidden student data;
- return or stream audio without requiring a student account;
- avoid saving prompts, reflections, listening history, or identity data;
- make any cache content-addressed and limited to public textbook prose;
- expose the same text as a transcript;
- support pause, resume, segment navigation, speed, and keyboard operation;
- keep provider credentials at the server boundary;
- document the provider and its data handling before activation.

No provider or UI should be added merely because the representation exists.
