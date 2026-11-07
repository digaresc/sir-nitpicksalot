# Contributing

Yes, thy PR shall be reviewed by Sir Nitpicksalot. No, he will not be gentle.

## Setup

```bash
npm install
npm test                          # every demand type: fails before, passes after
npm run demo -- lib/rules.ts      # what would the knight demand of this file?
npm run build
```

## Adding a demand type

Everything lives in `lib/knight.ts`. A demand type is two halves:

1. **A generator** in `GENERATORS`. Given the PR's added lines and file contents, it picks a target
   (a line, a file, the PR title…), rolls random parameters (`c.int(min, max)`, `c.pick([...])`) and
   writes the demand text. Return `null` when the diff gives it nothing to work with.
   Line-level demands should claim their line with `freeLine()`, so two demands never fight over one line.
2. **A checker** branch in `checkDemand()`. Given the files at the new head (plus title, description and
   new commit messages), it returns `{ ok, note }`. The note is what the knight says, so keep it in character: courtly, condescending, never cruel.

Then:

- Add the kind to the `DemandKind` union.
- If it only takes a minute to obey, add it to `QUICK_KINDS` (used by `STRICTNESS=lenient`).
- Teach `obey()` in `scripts/test-demands.ts` how an obedient hacker would satisfy it.
  `npm test` must show it failing on untouched code and passing once obeyed.

### Rules for demands

- **Obeying must never break the build.** Renames produce valid identifiers; anything added goes in a
  comment, the PR title/description or a commit message. Comment-based demands only target files in `COMMENTABLE`.
- **Checkable, not vibes.** If the checker can't decide objectively, it's not a demand, it's a mood.
- **Absurd, not mean.** Mock the code, the Council of Indentation or the dragon. Never the person.

## Other contributions

New intros/outros (`INTROS`, `OUTROS`), verdicts, ASCII subjects, virtues, noble ranks and steed names are all
just arrays in `lib/knight.ts`. PRs adding to them are the easiest way to make the knight funnier. Please keep
everything in English, family-friendly and in his voice (thee, thou, milord, royal decree).
