import { installTvInput, registerTvLayer, toAction } from "../../src/navigation/tv-input"
import { currentNavId, focusById, activeScreen } from "../../src/navigation/focus-nav"
;(window as any).H = { installTvInput, registerTvLayer, toAction, currentNavId, focusById, activeScreen }
