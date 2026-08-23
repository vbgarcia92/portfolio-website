# Assets

## mascot.png

The welcome splash looks for `mascot.png` in this folder. Until it exists the
splash still runs and falls back to a 🐒 emoji, so nothing looks broken.

Save the monkey picture here as `mascot.png`. The original three-pose image
works as-is — the splash crops to a single figure.

Which figure is shown is controlled by `--mascot-focus-x` in `style.css`
(under `.mascot-frame`):

| Value | Pose shown |
| ----- | ---------- |
| `95%` | right-hand, standing (default) |
| `50%` | middle, kettlebell press |
| `5%`  | left-hand, kettlebell carry |

If you drop in an image already cropped to one monkey, set
`--mascot-focus-x: 50%` and `--mascot-fit: contain`.
