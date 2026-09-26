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
