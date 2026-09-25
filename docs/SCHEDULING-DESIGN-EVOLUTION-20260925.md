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
