import { blue80, cyan50, gray100, gray50, gray60, magenta70, orange70, purple70, teal50, yellow50 } from '@carbon/colors/es/index.js'

// One colour per energy series, the same in every chart (docs/spec/07-design-tokens.md).
export const SERIES = {
  solar: yellow50,
  wind: teal50,
  battery: cyan50,
  grid: blue80,
  demand: gray100,
  price: magenta70,
  curtailment: orange70,
  emissions: gray60,
  bob: purple70,
  baseline: gray50,
}
