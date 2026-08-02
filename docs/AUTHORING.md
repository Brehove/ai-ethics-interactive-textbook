# Authoring

## Local Markdown

Edit a chapter at `content/chapters/<NN>-<slug>/chapter.md`. Keep its leading H1. Do not add YAML frontmatter; chapter identity and publication metadata live in the reviewed sidecars.

After a prose change:

```bash
npm run content:generate
npm run validate
npm run build
git switch -c content/<short-description>
git add content
git commit -m "Revise <chapter>"
git push -u origin HEAD
gh pr create --fill
```

Do not edit generated `reading.json` or `reading.txt` independently. Regenerate them from `chapter.md`.

## Browser editor

The `/admin/` route is a lossless text editor, not a WYSIWYG system. It:

1. checks the instructor's secure editor session;
2. loads an allowlisted existing file with its Git blob and base-commit hashes;
3. retains the source in memory only in the open page;
4. sends the edited file to the separate editor-auth Worker;
5. creates a server-named branch and pull request;
6. refuses a stale base or stale file instead of overwriting another edit.

The editor cannot choose another repository, owner, base branch, or head branch. It cannot merge `main`. GitHub App installation tokens remain server-side and short-lived.

## Reading record prompts

Before creating or revising student reflection checkpoints, read [`READING_RECORD_PROMPT_DESIGN.md`](./READING_RECORD_PROMPT_DESIGN.md). It is the controlling guide for the three-checkpoint sequence, research-informed strategy repertoire, passage anchoring, prompt planning record, and quality gate.

Do not add a prompt merely because a passage seems important. Each checkpoint must ask students to perform an identifiable philosophical reasoning operation at the point where the chapter has made that operation possible.

## Review

Use the pull-request diff and Cloudflare preview as the review surface. Reject unexplained changes to raw HTML, stable passage markers, rights records, or generated text. Merge only after CI passes.

## Conflicts

If local and browser editing touch the same file after it was loaded, the later save receives `409 stale_base` or `409 stale_file`. Reload, preserve both proposed changes, resolve them in a normal Git branch, and open a replacement pull request. There is no last-write-wins path.
