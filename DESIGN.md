# Lucy’s Birds Design System

## Visual Theme

An airy naturalist archive on near-white paper. Detailed bird illustrations sit directly in generous space, supported by restrained warm-gray rules and editorial typography.

## Color Palette

- Paper: `#fcfcfb`
- Recessed paper: `#f3f2ee`
- Ink: `#1a1612`
- Secondary ink: `#4a3f31`
- Quiet utility text: `#908576`
- Hairline: `#e9e5e0`

## Typography

- Display, bird names, and prose: Newsreader
- Controls, labels, metadata, and counters: Menlo
- Utility labels are uppercase with deliberate letter spacing.

## Components

- Controls use thin outlines or quiet paper surfaces, not dark filled boxes.
- Bird cards are open compositions centered around the illustration.
- Drawers use hairline divisions, generous white space, and spatially clear navigation.
- Icons come from Lucide with light stroke weights.

## Layout

- Full-width composition with responsive outer gutters.
- Large editorial heading paired with compact utilities aligned to its baseline.
- Five-column desktop bird grid, reducing cleanly at smaller breakpoints.
- Featured bird content stacks vertically on mobile.

## Motion

- Motion is quiet, fast, and spatially informative.
- Prefer transform and opacity with strong ease-out curves.
- Drawer exits are faster than entrances.
- Grid entrances must never delay interaction.
- Respect `prefers-reduced-motion`.
