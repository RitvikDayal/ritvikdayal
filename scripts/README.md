# How this page is built

The profile README is a column of SVG images with a little real text between them. GitHub will not load fonts
or run scripts inside an SVG image, so every glyph is drawn from outlines and every file stands on its own.

## Layout

```
README.md                    the page: <picture> tags that pick the dark or the light file
assets/                      generated and committed: one -dark.svg and one -light.svg per piece
assets/fallback/             placeholder signal cards, shown only if the workflow has never succeeded
assets/avatar.svg, .png      the profile picture
scripts/content.mjs          everything the page says
scripts/lib/theme.mjs        colours and type roles for both themes
scripts/build.mjs            content + theme -> assets/
scripts/telemetry.mjs        the live activity and language cards, run by the workflow
scripts/avatar.mjs           the avatar
scripts/atlas.json           glyph outlines for Archivo and JetBrains Mono
scripts/dev/make-atlas.mjs   rebuilds the atlas from the fonts
```

## Changing what it says

Edit `scripts/content.mjs`, then:

```sh
npm run build
```

That needs Node 20 or newer and nothing else. Commit the changed files under `assets/`. The numbers follow
ritvikdayal.github.io, so change both together.

Colours live in `scripts/lib/theme.mjs`. Dark is the site's palette as it is. Light is the same system on
paper, with the accents darkened until they pass 4.5:1 against the panel.

## Sizes

Full-width pieces use a 1200-unit viewBox and are shown 820 px wide. Cards use 840 units and are shown 410 px
wide, so two fit on a line on desktop and they stack on a phone. GitHub's README column is 846 px at best and
831 px on a 1280 px screen with a scrollbar, which is why the page stops at 820.

Two cards share a line only when there is no whitespace between their `<picture>` tags in `README.md`. The
8 px between them is a transparent gutter on the right edge of every file, so panels start flush with the
text on the left.

## Live cards

`.github/workflows/snake.yml` runs twice a day. It draws the activity and language cards with
`scripts/telemetry.mjs`, generates the contribution snake, and publishes both to the `output` branch, which is
where `README.md` loads them from. If the cards cannot be drawn the run fails, and the cards from the last good
run stay published.

```sh
npm run telemetry:sample     # draw the cards from a synthetic fixture into dist/sample
npm test
```

The cards read public data only: the workflow's own token cannot see private contributions.

## Adding a character

The atlas holds ASCII and a short list of punctuation marks. A character it lacks fails the build and names the
code point. Add it to the lists in `scripts/dev/make-atlas.mjs`, then:

```sh
npm install
npm run atlas
```

This is the only step that needs dependencies.
