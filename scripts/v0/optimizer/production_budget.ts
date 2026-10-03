/** The default compile allowance, in physics frames, scales with ride length.
 * The production search at full width spends 1,200–1,550 frames per ride frame
 * on the evaluation panel (2026-10-04); a fixed allowance would starve long
 * songs (a 3-minute song at 3M frames matches a 45 s song at 0.75M, where one
 * compile in five ran out before the end). */
export const BUDGET_PER_RIDE_FRAME = 1700;

/** Allowance for a ride of `seconds`, covering every frame through the end
 * margin the compiler simulates. */
export const productionBudget = (seconds: number) => BUDGET_PER_RIDE_FRAME * (Math.round(seconds * 40) + 21);
