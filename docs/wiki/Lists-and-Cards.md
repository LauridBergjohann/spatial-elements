# Lists and Cards

`ListSection` uses one card size and text alignment for all items in the section. The defaults are `cardSize="m"` and `textAlign="start"`. `start` follows the text direction.

Create the item projection with `getSpatialListItems` so model assets and detail data use the same identities. If one element appears more than once in a list, give each occurrence its own stable `itemKey`; rows are keyed by `itemKey ?? id`. Keep those keys stable when filtering or reordering the list.

```svelte
<ListSection section={{ id: 'products', title: 'Products', headline: 'Collection' }}
  list={items} cardSize="l" textAlign="center" />
```

<!-- layout-card-table:start -->
| Size | Grid span | Title size / line height | Eyebrow size | Total text rows |
| --- | --- | --- | --- | --- |
| S | 1 | 9 / 18 | Hidden | 1 |
| M | 2 | 12 / 20 | 10 | 2 |
| L | 4; 3 in grid S | 18 / 24 | 14 | 3 |
<!-- layout-card-table:end -->

Titles use weight 500; eyebrows use 400. An eyebrow consumes one of the total rows and shares the class's line height. Blank eyebrows consume no row. Long visible text clamps with ellipsis, while the link retains its full accessible name.

## Square allocation, undistorted media

![A square medium card contains a 4:3 media fit area and a text area. At 320px the reserved text area grows and the media fit becomes smaller without stretching.](images/card-fit.png)

*Both examples stay square. Media shrinks when the fixed text line budget needs more space; typography does not silently shrink.*

The normal media allocation fills the upper three quarters of the square card. The actual model/poster fits inside it without distortion. Empty space around a shape is expected; hover can extend presentation beyond the resting fit without changing the grid.

Very small cards need an explicit exception. Reserve at least `rows * lineHeight + 4px` for text, or one quarter of card height if larger. Fit and center a 4:3 media rectangle in the remaining area. The extra 4px is a deliberate 2px allowance above and below text. A 4px inline text inset is also an engineering allowance, not another grid gutter.

At a 320px XS container, an M card is 142px square. Two 20px lines need a 44px text zone; the remaining media fit is approximately 130.67 × 98px. This keeps the specified text readable and the geometry undistorted.

## Interaction and fallback

Cards remain real links with stable occurrence identities. Server-rendered text and poster dimensions exist before a GPU renderer starts. The enhanced text handoff preserves fractional positions. Mouse proximity rotates individual cards; touch scrolling keeps its native navigation behavior. When enabled by the enclosing shell, device orientation activates automatically when available and permitted, with scroll pause, a new resting reference after scrolling and a gradual return.

The full title must remain available to assistive technology. Keep focus outlines visible. Test any host font override or large text setting against the smallest supported cards; a fixed square cannot hold unlimited enlarged text.

Use `/demo/layout-cards` to compare all three sizes, long text, blank eyebrows and centered alignment. Its tests include 320px and the six-column S-grid exception, where two large cards fit per row.

## Real card sizes and long text

![Public card fixture at 320px shows small and medium square cards, long clamped titles and reserved eyebrow rows.](images/cards-320.png)

*At 320px, the M-card text reserve reduces the media fit while keeping fixed typography. A blank eyebrow leaves its row available to the title.*

![Public card fixture at 840px shows the same small and medium entries using the eight-column container grid.](images/cards-840.png)

*The card allocation grows with its container; text sizes remain the authored S/M/L values.*

![Large centered cards at 720px use three columns each in the six-column S grid, with two complete cards per row.](images/cards-large-720.png)

*The grid-S exception keeps two large cards per row without changing their typography or aspect ratio.*
