# Assets

## mascot.png

The welcome splash shows this image on load. It is a 387×659 transparent PNG,
cut out of the original gym photo so it sits directly on the app's dark
background with no framing.

It was produced from `energetic_trainer_mascot.png` by:

1. Flood-filling the light backdrop inward from the border.
2. Removing light areas the fill could not reach — the gap under the arm, the
   hole in the kettlebell handle — identified by colour temperature, since the
   backdrop is cool (blue ≥ red) while skin and teeth are warm or neutral.
3. Keeping only the largest remaining shape, which drops the sliver of the next
   figure at the right edge.
4. Softening the cut edge, trimming to the subject, and quantising to 128
   colours (358 KB → 44 KB, no visible banding).

To swap in a different mascot, save any transparent PNG here under the same
name. A roughly portrait aspect works best; the frame is set to `387 / 659` in
`style.css` under `.mascot-frame` and wants updating if yours differs a lot.

If the file is missing entirely the splash still runs and falls back to a 🐒
emoji, so nothing looks broken.
