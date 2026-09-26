# Scheduling design: preserve the learning, not just the shape

User reminder, 25 September: the original Simple experience already had a horizontal bar; Advanced evolved to diamonds and a fermentation graph. Returning to a horizontal control is not, by itself, an improvement.

| Stage | Useful contribution to preserve | Problem the current revision addresses |
| --- | --- | --- |
| Original Simple horizontal bar | Direct, familiar time adjustment | A control alone does not explain the recommendation or dependent changes |
| Advanced diamonds and graph | Visual relationship between actions and fermentation; explicit baker adjustments | Combined scientific representation and editing can be dense on a phone |
| Recent vertical key-action controls | Each preparation action has a named, independently editable time | Always-open tracks consume space; green windows and boundary points are difficult to see |
| Current recommendation-first preview | Compact proposed actions; flexible ranges visible before editing; optional horizontal editor; explicit oven target | Must prove live full-candidate consistency, protection of manual choices and a reliable return to recommendation |

The current source retains the original bar/diamond code and FermentChart engine helpers. This revision does not remove those helpers or change biological coefficients. It does not claim that rotating a slider improves the science or the interface by itself. The fermentation explanation and the editing affordance have different jobs.

Acceptance criteria:

- The target clearly means first pizza/bread oven entry (pan-cooked bread is labeled accordingly), and survives presets, availability, navigation and reload.
- Recommended actions are readable before touching any controls; explicit step progress belongs to Organisation.
- Adjustment windows represent complete supported candidate plans. Automatic dependent actions may move; explicit manual choices remain constraints.
- Edited candidates show dependent consequences, a current specific conflict, Apply/Cancel and a persistent route back to the current recommendation.
- Horizontal controls are revealed on demand and support exact time input. Mobile visual evidence must establish readability and touch accessibility.
- Model detail remains available without repeated explanatory paragraphs. Conditional bread folds and unspecified handling durations are disclosed, not converted into invented biological certainty.

Retain this comparison in future redesigns. Judge changes against these tasks and the user's observed mobile friction, not against novelty of a control's shape.

## Touch refinement — 26 September

The recommended plan remains the default. Editing mixing automatically places commercial preferment at the existing model optimum where constraints permit; the optimum is not simply the midpoint of the green region. A baker can explicitly select **Fixer cet horaire** to keep preferment fixed. Editing its time alone no longer implies a permanent lock against future mixing edits. A locked conflict must remain visible and block Apply rather than silently move that choice. Unchecking releases the constraint; **Revenir aux horaires recommandés** clears timing overrides and computes a plan against the current oven target and availability.

Horizontal editing remains deliberate: it follows the familiar earlier Simple time axis and leaves room for a readable green interval on a phone. During dragging, the selected thumb/time updates locally; the active compatible map remains visible for guidance, other maps are neutralized, and the full dependent plan is recalculated on release. Exact entry and keyboard edits remain available. Apply/Cancel preserve a reviewable draft.

The planning screen omits After baking; serving/cooling information belongs to its existing guide. Alternative bake presets appear only before choosing a target or when the chosen plan is incompatible. A valid saved oven target stays visible without the repeated presets disclosure.

Touch targets must remain stationary during a tap, clear the browser edge and stay unobscured by sticky controls. Physical iPhone Safari chrome is a separate validation gate from WebKit viewport emulation; neither a desktop drag nor passing CI proves the native first-tap issue resolved.

## Linked adjustment panel — 26 September, second recording

The baker's new recording showed that separate editors obscure the relationship. Opening either action now reveals both horizontal controls in one panel, with a two-time recap, the retained oven target and one Apply/Cancel transaction. The existing model optimum still guides automatic preferment following; explicit locks remain visible. This preserves the relational value of the earlier diamonds/graph without requiring a second scientific chart to change an hour.

An invalid selected plan must offer a concrete next action. Alternative oven targets now run the same complete fixed-bake candidate search as availability replanning, including recurring blocks and actual manual locks. They appear beside the conflict, never as an unexplained empty “Other times” heading. Choosing one commits the verified dependent plan atomically. Search remains bounded; failure does not prove physical impossibility.

The noon Saturday/night-block example was reproduced with explicit fixture assumptions (cold poolish, kitchen22°C/fridge6°C, spiral mixer, Neapolitan4×260g). The model found no supported plan for Sunday11:30 but did find Sunday19:30. Do not misdescribe this as automatic replanning never running, and do not loosen fermentation bounds to make a green window appear.

Mobile setup keeps the site header stable and puts navigation actions in document flow so they cannot cover controls. Step transitions reset scroll before paint, release stale input focus, and cancel delayed settling as soon as the baker interacts. Plan states distinguish recommendation, applied customization, pending changes and conflicts. Read-only clock faces use 24-hour formatting while retaining native date/time controls.

## Compact chronological timeline — approved 26 September

After reviewing the linked panel, the user preferred a vertical chronology prototype. Independent timeline and sourdough UX reviews agreed on a neutral event spine, day headings once, all linked event times visible, and one active time editor. The spine represents sequence rather than elapsed time; no draggable proportional vertical scale is introduced. Exact date/time and ±30 minute taps replace the horizontal tracks, avoiding drag-versus-scroll ambiguity and duplicate dates. Compatible full-plan windows belong to the selected action. Simple and Custom share this interaction; sourdough may have more than two events, including immutable history and calculated cold transfers.

A further independent review put **Conserver l’heure du poolish / du rafraîchi pour la pâte** inside the mixing editor, where its consequence matters. Default preparation follows mixing within the existing model; a direct preparation edit does not silently keep it forever. The preparation row displays **Heure conservée** for the explicit choice. Release recalculates from the displayed mixing time; conflicts still block Apply. Reset releases choices while preserving oven and availability. Apply/Cancel appear only for actual draft changes; opening or closing an editor alone is not a change. Small guidance **Touchez une heure pour l’ajuster** replaces the large Adjust button.

This supersedes the earlier always-visible windows and simultaneous horizontal-editor criteria while retaining their important gains: coupled calculations, visible relationships, complete-plan validity, explicit user constraints, and reversible drafts. Deployment verification is recorded in PROJECT-HANDOFF.md.
