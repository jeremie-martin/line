# How we worked, from the session logs (2026-10-31)

A read-only study of Jérémie's own messages to his AI collaborators from late July to 31 October 2026. It asks what those messages say about how to work on the compiler now. It complements [how-we-worked-record-20261031.md](how-we-worked-record-20261031.md), which works from the docs, commits and memory. This one works from what he actually typed or dictated. No code or data changed.

## Coverage

| session | tool | dates | how read |
|---|---|---|---|
| `019faed2` ("follow goal.md until >590") | Codex | Jul 29–31 | all 20 owner messages (context just before the window) |
| `019fb884` (fresh V2 baseline, sequential promotion rule) | Codex | Jul 31 | all 32 owner messages |
| `019fdae7` (August review, 650 campaign, repair, backtracking) | Codex | Aug 7–16 | all 93 owner messages; key ones in full |
| `01a00a55`, `01a01692` | Codex | Aug 16, Aug 18 | read; one-question sessions (promotion rule; disk space) |
| `01a07b33` ("please start a new campaign") | Codex | Sep 7 – Oct 6 | all 101 owner messages; about 30 in full |
| `d61f58ee`, `52804bca`, `02d981db` (Codex-era audit and rework) | Claude | Oct 3–5 | all owner messages; two short false starts |
| `01a102c9` (export tool), `01a18216` (re-entry with a "lesser agent") | Codex | Oct 3, Oct 28 | all owner messages |
| `897a8423` (current session) | Claude | Oct 29–31 | owner messages only, skimmed; not the agent side |

**Skipped.**
- 168 Codex subagent threads. They contain no owner messages.
- Two duplicate Jul 31 runs of a delegated baseline prompt.
- Sessions in other repos.
- Everything before Jul 29.

**Not on disk.** No Claude Code transcripts exist for this project before Oct 3, so the June–August Claude/Fable era is visible only through the record study.

**Method.** I read the owner's messages with the tail of the agent message each one answered, using `agent-export --format json`. I did not audit the agents' work. Many of his messages are long dictated monologues, so the quotes below are trimmed.

## 1. Timeline: what he was trying to do

**Late July: pushing a headline, then building the measuring instrument.** He gave Codex a goal ("until the headline score reaches >590") and stepped in on method:
- He moved from N=2 and N=8 to "only work at N=48".
- He dropped 250k and 500k to focus on 750k.
- He pushed the statistics: "inconclusive? why? this sounds great"; "is a threshold on the lower bound the only sane way?"
- This produced the sequential promotion rule.

His ideas were physical: aim the arc at a speed other than the gap mean so the impact lands. Even then he insisted on scale: "It should scale to 1 million… 3 million, or even 150K" (Jul 29).

**Aug 7–16: unease, audit, then a 650 campaign that became search research.** It opened with: "I don't feel very comfortable with the commits… since the 1st of August… so many changes had such a small impact" (Aug 7). He asked for an audit of *areas*, not commits, and for "discovery" before answers. He then approved an autonomous 650 campaign.

A budget sweep he ran himself (Aug 10) redirected the work:
- the candidate-breadth exponent;
- a multi-budget sweep tool;
- a telemetry/metric audit;
- his own design of a simpler repair: "every time we go to the end… a new independent, self-contained repair";
- a general backtracking search: "I'm basically asking for a new strategy… it has nothing to do with the repair".

The headline moved a few points; by Aug 13 he asked, "did we do any meaningful progress these past 2 days?"

**Sep 7–11: a fresh campaign, a leap, and a taste correction.** "The previous ones were not very successful… work in a way better way" (Sep 7). Codex jumped the score with acceleration lines, then with point "constellations". He rejected both on sight:

> "I do not like how it looks at all… before we had all of these beautiful arcs." (Sep 8)

Codex adapted the control idea to arcs ("two arcs… almost parallel"), and he was delighted: "breakthrough upon breakthrough… aligned with what we want" (Sep 8). He then let the agent build V3/V4 benchmarks and reopened goals step by step: 900 → 910 → 920 → 930 → 940 (Sep 9–10). After that he asked for design-level cleanup: "a massive improvement in terms of design simplification… let's not [reject] just because we lose one point" (Sep 11).

**Sep 29 – Oct 2: from score to repertoire and intent.** He wanted "a vestiaire of primitives" and a gallery, because "the goal of this project is first and foremost to create super cool tracks" (Sep 29). He judged geometry by eye:
- "folded is great, it's completely different" (Sep 30);
- the decorative "ribbons" were "almost just drawing" (Sep 30).

He also felt lost: "all of this seems a bit fuzzy and a bit fragile and not under control" (Sep 30). Then came the first real doubt about the number: "back in mid July… the headline score was about 650 but it felt like the impact was cleaner… even [at] 900–940… the generated tracks were super boring" (Oct 2).

**Oct 3–5: audit and rework with Claude.** He asked for an independent review: "It would be absolutely terrible to hand-wave" (Oct 3). He accepted the finding that the codebase was "muddy" and asked for a full rework on clean foundations. Absolute impact grading failed ("what am I judging really?", Oct 4). Blind pairwise clips worked ("very fun and convenient", Oct 4). He handed the impact definition to the agent's discernment and asked for an overnight push on the compiler.

**Oct 28–31: re-entry, specs, and back to the compiler.**
- A "lesser agent" re-entry that tidied a README "didn't go the way I was hoping" (Oct 29).
- He then worked on music specs with the agent (Trouble, Valhalla "basically production ready", Circus Minimus).
- He approved careful groundwork, a new benchmark and a first compiler attempt.
- He reasserted two principles: general mechanisms ("what's a short section?… what happens at 260?") and the headline ("let's not throw away this", Oct 31).

**Direction of travel.** The project moved through three phases:
1. Optimize a number (July–August).
2. The number explodes but the tracks look wrong or boring (September).
3. Define what we want with his eyes, rebuild clean foundations, then improve the compiler against a validated measure without losing the headline instrument (October).

## 2. What he said about process, by theme

**Autonomy and checking in.** He swings between "go" and "discuss", and the switch is principled. Once a plan is agreed, he wants long autonomous runs:
- "do not stop the campaign under any circonstance, and do not ask any question" (Aug 7);
- "it feels like quite often… you do something that is… just a very small task… and then you stop. … you could be much more bold" (Sep 30);
- "That's such a missed opportunity" when an agent waited all day for his answer (Oct 2);
- "Full greenlight… implement the entire roadmap in its entirety" (Sep 30, Oct 1).

But "we are not planning work for three weeks… if you launch some stuff that takes five hours just to get some initial result, that would not be adequate" (Oct 4). And he wants to stop agents cleanly: "note down what you wanted to do next, then please stop" (Aug 10).

**Discussion before action.**
- "Please do not jump right ahead. Please try to understand what I am asking… it should almost be some sort of discovery" (Aug 7).
- "Before jumping on anything, what do you think?… Could we have a discussion about this?" (Oct 31).
- He often thinks aloud and asks to be reflected back: "I'm not being very clear, do you understand what I mean?" (Aug 10). "Please do not completely rewrite the roadmap based on my extremely confusing… feedback" (Oct 2).
- After a break, orientation comes first: "this project can give me vertigo… I wasn't looking just to clean up a README" (Oct 29).

**Agents and delegation.**
- Use subagents for fresh, unbiased views: "launch a sub-agent, without biasing it too much… for a fresh view" (Sep 30); "maybe having even some fresh views… could be helpful" (Oct 4).
- The lead agent does the thinking: "Sub-agents are basically providing information for you then to process… this is more for you to identify. It's not for the sub-agents" (Aug 10).
- Mind cost and nesting: "each of these sub-agents sometimes launch tons of sub-agent themselves… that was going a bit too much. We don't have infinite… token usage" (Oct 3).
- Model quality matters: "i wouldn't trust gpt-6-luna ideas" (Sep 30).
- Praise for a well-scoped delegation: "great delegation, great orchestration… byte identical… exactly what I was expecting the agent to do, nothing else" (Oct 30).

**Benchmarks and the headline.** He values the headline as the shared instrument and has defended it repeatedly:
- "the whole point of the benchmark is to rely on the overall headline score… that's why we are running so many seeds" (Sep 8);
- "We have been working with headline scores… for months and months. Extending the scaffolding is fine, but let's not throw away this" (Oct 31).

But he does not treat it as the goal:
- "we don't want to optimize a mis-aligned metric… let's not change things just for the sake of changing things" (Sep 9);
- "it's not just a matter of improving your headline score… we should not lose ourselves by improving some weird metric while everything else breaks down" (Oct 5);
- "we can even accept very minor decrease in the headline… if it improves… across many budgets" (Aug 10).

He also wants completion separated from quality: "is it because of some failure… or is it that we actually find worse results?… present… the general, and… the without failure" (Aug 14).

Honest caveat: in July–August he also pushed promotions ("I really, really want you to actually promote that, whatever the results say", Jul 31; "push it to 96 seeds? it looks like it will be accept", Aug 14). By Aug 7 the audit had found "repeated forced promotions". He now holds himself to the stricter view, which the CLAUDE.md rules encode.

**Thresholds versus general mechanisms.** This is the most consistent theme across all three months:
- "I really hope that… this kind of logic… [scales] beyond the benchmark budget" (Jul 29);
- "There's no hard-coded stuff, right? Everything is just based on this threshold" (Jul 31);
- "we should only be relying on the probability that a change is positive… we shouldn't have any gate about… a loss above a certain threshold" (Aug 16);
- "any kind of stuff that are… way too hardcoded" (Sep 11);
- "What's a short section? Is it a threshold, let's say, less than 250 milliseconds? Yeah, but what happen at 260?… generalize, make it smooth" (Oct 31).

He allows situation-specific logic only "careful[ly] and mindful[ly], and intentional[ly]" (Oct 31).

**Complexity and cleanliness.**
- "Prefer deletion, consolidation, and clear invariants over quick workarounds, band-aids, special cases… or backward-compatible shims" (Oct 5).
- "Everything has to earn its keep" (Oct 5).
- He reviews for over-engineering, not just bugs: "did we implement the right thing, without going overboard and without overcomplexifying things" (Jul 31).
- But not demolition: "I do not want to cast straight to the project and to completely remove everything that is not strictly used" (Sep 8). And "we don't have to throw everything away" (Oct 3).

**Honesty and reporting.**
- Smells get challenged at once: "99% really? are you sure?… like a huge smell to me" (Sep 11); "Wait what? Did we change the scorer, or benchmark?… on how many seeds?" (Sep 7).
- Claims need data: "we need empirical evidence for that" (Aug 10); "Did we look at the data?" (Jul 30).
- Findings are re-confirmed before they are fixed: "be rock solid sure that these are actual issues… not wrongly fix something that was not broken" (Oct 5).
- What he values most, as he put it: "that we were always doing apple-to-apple comparison, that the results were honest throughout" (Oct 3).
- Explanations should be plain: "what's the input, what's the output, how is it used, how was it trained?" (Aug 16). On Aug 16 he also gave a writing standard for agent-facing text: one meaning per word, preserve every qualifier and degree of uncertainty.

**Openness to several approaches; no early verdicts.**
- "what we currently have is one solution to a problem… one execution of an idea. But there could be many others" (Jul 31).
- "this is merely the very first implementation of this idea… I don't think we should be drawing any too strong of an opinion" (Aug 14).
- "If… a geometry… doesn't immediately work, we cannot conclude… No hand-waving… [and not] defeatist" (Sep 30).
- "we should be quite careful in saying must, have to, shall… this is one approach" (Oct 31).

**Taste and variety.** He judges by watching, and sight overrides score:
- the constellations and acceleration lines were rejected despite huge scores (Sep 8);
- "I love the variety… the originality… how much more original and dynamic this is" (Oct 1).

Variety is not a number either: "the goal is not to maximize the diversity… [the pool] was implemented as a quick solution" (Oct 31). His preferences are soft: guide rails are "not what I prefer, if we can do without, I think I'm happy" (Oct 31). The scattered "messy primitive" could be "a legit primitive… used sparingly" (Sep 29).

**Documentation.**
- "note that down to a file (as well as some context about it, the scope, the why, the what/how)" (Aug 10).
- "write the roadmap, and commit the roadmap" (Sep 30).
- "including the update of all the related documentation (markdown, docstring, comments)" (Jul 31).
- He also wants a concise progress note during overnight work (Oct 5).

**Other.**
- **Resource care.** He noticed OOM crashes and runs stalled by other jobs: "we should be able to use 48 jobs" (Aug 11). He gave a bounded overnight window (Oct 4).
- **Budget as part of the spec.** "when I use this compiler, this is with a given budget… the only thing that I'm interested in is the best result… with the given budget" (Aug 10). With a fixed budget he expects frames to be "kind of constant" (Oct 31).
- **Owner input that fits his life.** He works over SSH and from his phone, and he has limited weekday time. Grading 120 clips "would take close to two hours" (Oct 3). Paired 7-minute studies worked.

## 3. What made sessions go well or badly

**Went well:**
- **A clear shared understanding, then a long, whole execution.** Sep 30 → Oct 1 is the clearest case: a roadmap discussed, then "Full greenlight", 6–8 hours of work, and "utterly amazed… how aligned it is".
- **The agent turned his visual objection into a better mechanism instead of defending the score.** On Sep 8, constellations became the arc-based double rails, and he called it "working exactly on the kind of way that I wanted you to work… not only the results; it's the way".
- **Independent audits that told him uncomfortable things.** Oct 3: "This is exactly the kind of investigation I was hoping for."
- **Perceptual questions made small, blind and pairwise, in his own dashboard** (Oct 4).
- **Well-bounded groundwork done to parity, then stopped** (Oct 30).
- **Spec work where he could react to concrete variants** (Oct 31).

**Went badly:**
- **Score went up but the tracks did not get better.** The Aug 1–7 commits ("so many changes… negligible impact"). The Sep 9 climb to 940 that later felt "super boring" with worse impact.
- **Agents stopped after small steps,** or waited idle for answers.
- **Long stretches without visible progress** (Aug 11–13).
- **Measurement built before the question was clear,** so he could not tell what he was judging (Oct 3–4).
- **Agents locked a design detail into his idea.** The repair "up to four upstream ancestors"; the backtracking idea framed as a repair path (Aug 11, Aug 14).
- **Deprecation of established instruments without being asked** (the headline, Oct 31).
- **Cosmetic re-entry work instead of orientation** (Oct 28).

**The common thread.** He is satisfied when the agent understood *why* and acted at the level of the idea. He is frustrated when the agent optimized a proxy, stopped short, or narrowed his idea into a special case.

## 4. Recommendations for the compiler work starting now

1. **Agree on direction in conversation, then run long.** Before a compiler round, restate his idea in your own words and propose a scoped plan. Once he says go, execute the whole plan without stopping after a sub-step. Evidence: "do not jump right ahead… discovery" (Aug 7); "you do something… small… and then you stop" (Sep 30); "Full greenlight… in its entirety" (Oct 1).

2. **Prefer smooth, general mechanisms; justify any threshold.** Express behaviour as a continuous law of the situation (gap length, budget, ask), not as a cutoff. If a special case is unavoidable, say so explicitly and say what happens just past it. Evidence: "what happen at 260?" (Oct 31); scale to "1 million… or even 150K" (Jul 29).

3. **Keep the headline and extend it; never let it stand alone.** Compute the headline as before on any new benchmark. Report completion separately from quality, plus the other rulers, and treat it as an instrument, not the goal. Evidence: "let's not throw away this" (Oct 31); "the general, and… the without failure" (Aug 14); "we don't want to optimize a mis-aligned metric" (Sep 9).

4. **Watch the rides; his eyes outrank the number.** Ship each meaningful compiler change with a few plain horizontal clips or a small blind pair study. A score gain whose tracks look worse is a failure. Evidence: constellations rejected (Sep 8); "impact was cleaner" at 650 than at 940 (Oct 2); pair studies "very fun and convenient" (Oct 4).

5. **Treat a first implementation as one execution of an idea.** A negative first result does not close the idea. Report what was tried, and propose a better execution or an alternative before concluding. Evidence: "one execution of an idea… there could be many others" (Jul 31); "very first implementation… [no] too strong of an opinion" (Aug 14); "not defeatist" (Sep 30).

6. **Keep his idea at the altitude he stated it.** When he proposes a mechanism (for example a general backtracking search), build it as the general thing. Do not narrow it into a subsystem or add structure he did not ask for. Evidence: "this has nothing to do with the repair" (Aug 14); "up to four upstream… I think that's unnecessary" (Aug 11).

7. **Be honest about smells and check before fixing.** Flag implausible numbers yourself. State seeds, scope and what changed in the scorer. Re-confirm findings before acting on them, and say when a finding does not warrant a change. Evidence: "99% really?… a huge smell" (Sep 11); "rock solid sure… not wrongly fix something that was not broken" (Oct 5).

8. **Simplify at the root, but don't demolish.** Prefer deletion and invariants to patches and shims, and accept a point or two of headline loss for a clearly better design. Keep working machinery and the evidence that months were built on. Evidence: "Prefer deletion, consolidation, and clear invariants" (Oct 5); "let's not [reject] just because we lose one point" (Sep 11); "not… completely remove everything" (Sep 8).

9. **Delegate narrowly and think centrally.** Use few subagents, each with a bounded brief, and none spawning more. Use them for groundwork with parity, or for an unbiased second opinion. Keep synthesis and design with the lead agent. Evidence: "tons of sub-agent… too much" (Oct 3); "Sub-agents… providing information for you then to process" (Aug 10); "great delegation… nothing else" (Oct 30).

10. **Get fast signal before slow signal.** Design experiments to give a first answer in under an hour on focused cases. Reserve full multi-seed runs for decisions. Never leave the CPU idle while waiting for him. Evidence: "if you launch some stuff that takes five hours just to get some initial result, that would not be adequate" (Oct 4); "super efficiently (not only with heavy slow v2 benchmark runs)" (Aug 14); "missed opportunity" (Oct 2).

11. **Write it down as you go, plainly.** Each campaign gets a short file covering why, scope and how; a progress log; and commits. Explanations use defined terms and say input, output and use. Evidence: "note that down to a file (… the scope, the why, the what/how)" (Aug 10); "what's the input, what's the output, how is it used?" (Aug 16).

12. **Make his input cheap and clear.** Ask few, decisive questions in his own dashboards over the VPN. Separate what is his choice from what you can decide. When he hands a decision over, decide it and own it. Evidence: "what am I judging really?" (Oct 4); "I trust you on this… build something that you believe makes sense" (Oct 31); "I don't want to take you by the hand" (Oct 3).
