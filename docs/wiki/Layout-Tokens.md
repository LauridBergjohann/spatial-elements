# Canonical layout tokens

Generated from `@page-sections/core` and the spatial-only `layoutTokens.json`, as consumed by the pure resolvers and CSS generator. Values are CSS pixels unless a field explicitly describes a ratio, count, span or font weight. Regenerate with `node docs/wiki/export.mjs --write`.

## contentMax

1536

## layoutMinWidths

| Token | Value |
| --- | --- |
| xs | 0 |
| s | 600 |
| m | 840 |
| l | 1200 |
| xl | 1600 |
| 2xl | 1809 |
| 3xl | 2300 |

## grid

| Name | minWidth | columns | gap | headlineSize | headlineLineHeight | bodySize | bodyLineHeight | headlineGap |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| xs | 0 | 4 | 12 | 18 | 28 | 14 | 20 | 8 |
| s | 600 | 6 | 16 | 18 | 28 | 14 | 20 | 8 |
| m | 840 | 8 | 16 | 20 | 32 | 14 | 20 | 12 |
| l | 1200 | 12 | 24 | 24 | 40 | 16 | 24 | 16 |

## cards

| Name | span | titleSize | titleWeight | eyebrowSize | eyebrowWeight | lineHeight | rows | gridSSpan |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s | 2 | 12 | 500 | 0 | 400 | 18 | 2 | — |
| m | 2 | 14 | 500 | 12 | 400 | 20 | 2 | — |
| l | 4 | 18 | 500 | 14 | 400 | 24 | 3 | 3 |

## cardTextInset

| Token | Value |
| --- | --- |
| inline | 12 |
| block | 12 |

## xlContentInset

136

## menu

| Token | Value |
| --- | --- |
| height | 66 |
| wideHeight | 64 |
| wideTop | 16 |
| scrollThreshold | 112 |

## satellite

| Token | Value |
| --- | --- |
| width | 80 |
| height | 40 |
| inset | 28 |
| top | 28 |

## breadcrumb

| Name | fontSize | height |
| --- | --- | --- |
| xs | 10 | 24 |
| s | 10 | 24 |
| m | 12 | 30 |
| l | 14 | 40 |
| xl | 14 | 40 |
| 2xl | 14 | 40 |
| 3xl | 14 | 40 |

## cardMediaInset

8

## pane

| Token | Value |
| --- | --- |
| centerGap | 8 |
| rightInset | 20 |
| top | 96 |
| bottom | 16 |
| submenuHeight | 44 |
| headerHeight | 86 |
| minUsableHeight | 512 |

## stageControls

| Token | Value |
| --- | --- |
| buttonSize | 40 |
| groupButtons | 2 |
| gap | 8 |

## hero

| Name | minHeight | heightOffset | maxHeight | railSize | railGap | railInset | railStageGap | summaryColumns | summaryInset | summaryGap | dockHeight | submenuHeight | submenuGap | submenuAfterGap | submenuLeft | submenuRight | zoomMinimap | zoomInset | railWidthRatio | railMinInset |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| xs | 150 | 214 | 400 | 80 | 8 | 8 | 8 | 4 | 8 | 8 | 76 | 0 | 0 | 0 | 8 | 8 | 112 | 8 | — | — |
| s | 150 | 214 | 500 | 80 | 8 | 8 | 8 | 6 | 8 | 8 | 76 | 0 | 0 | 0 | 8 | 8 | 112 | 8 | — | — |
| m | 300 | 180 | 500 | 80 | 12 | 8 | 8 | 3 | 8 | 8 | 80 | 40 | 8 | 8 | 8 | 8 | 168 | 8 | — | — |
| l | 340 | 194 | 600 | 80 | 16 | 8 | 8 | 4 | 24 | 8 | 86 | 44 | 8 | 8 | 8 | 24 | 178 | 8 | — | — |
| xl | 400 | 236 | 700 | 112 | 16 | 12 | 12 | 4 | 12 | 8 | 86 | 44 | 12 | 12 | 0 | 0 | 220 | 12 | — | — |
| 2xl | 400 | 216 | 800 | 138 | 24 | 0 | 24 | 4 | 0 | 24 | 86 | 44 | 12 | 12 | 0 | 0 | 242 | 16 | 0.07 | 8 |
| 3xl | 400 | 112 | 800 | 138 | 24 | 28 | 12 | 4 | 0 | 16 | 86 | 44 | 0 | 0 | 0 | 0 | 242 | 28 | — | — |

## carousel

| Token | Value |
| --- | --- |
| dotsHeight | 32 |
| nextPreviewHeight | 28 |
| compactTitleHeight | 40 |
| compactEyebrowHeight | 66 |

| Name | minHeight | maxHeight | sideAllowance | fitStartColumn | fitColumns | summaryStartColumn | summaryColumns | dotsGap |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| xs | 150 | 300 | 36 | 1 | 4 | 1 | 4 | 0 |
| s | 150 | 400 | 72 | 1 | 6 | 1 | 6 | 0 |
| m | 300 | 500 | 0 | 2 | 3 | 5 | 3 | 12 |
| l | 340 | 600 | 0 | 3 | 5 | 8 | 4 | 16 |
| xl | 400 | 700 | 0 | 2 | 5 | 7 | 4 | 16 |
| 2xl | 400 | 800 | 0 | 2 | 6 | 8 | 4 | 16 |
