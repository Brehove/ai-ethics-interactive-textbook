# Chapter 7 Reading Record Plan

Status: prototype planning record

Controlling standard: `docs/READING_RECORD_PROMPT_DESIGN.md`

```yaml
chapterId: ch07
reasoningObjective: >-
  By the end of this chapter, students should be better able to test an
  AI-mediated practice against Aristotle's account of practical wisdom in
  order to form a considered judgment about when assistance becomes
  substitution.
checkpoints:
  - id: opening-judgment
    passageId: ch07-p0004
    stage: Opening judgment
    strategy: initial-judgment
    title: Commit to a starting judgment
    trigger: Where, for you, does assistance become substitution?
    prompt: >-
      Classify the AI-written apology as assistance, substitution, or
      something in between. Identify the single feature of the case doing the
      most ethical work in your judgment, and explain why.
    guidance: >-
      Commit before Aristotle supplies his vocabulary. A serious response
      names a feature of this particular case and connects it to the verdict.
    responseStructure: prose
    rationale: >-
      The opening case has made the ethical tension visible without yet
      supplying Aristotle's interpretation, so the student can preserve an
      independent starting judgment and its warrant.
  - id: hinge-judgment
    passageId: ch07-p0041
    stage: Practical-wisdom test
    strategy: contrast-case
    title: Test the boundary
    trigger: What change to the case would move your judgment?
    prompt: >-
      Change exactly one feature of the apology case so that your judgment
      about the AI assistance would change. Name the feature, state the new
      judgment, and explain why practical wisdom makes that feature decisive.
    guidance: >-
      Keep the rest of the case fixed. Use the contrast to show which
      particular fact controls the boundary you draw between help and
      substitution.
    responseStructure: prose
    rationale: >-
      The anchored passage has established that phronesis concerns particulars
      and distinguishes tools that support noticing, deliberating, and choosing
      from tools that replace those activities. A one-feature contrast case
      makes the student use that distinction rather than repeat its definition.
  - id: exit-judgment
    passageId: ch07-p0062
    stage: Exit judgment
    strategy: metacognitive-trace
    title: Form a considered judgment
    trigger: What survived the strongest pressure on your view?
    prompt: >-
      Classify your judgment as changed, qualified, strengthened, or unchanged.
      Identify the chapter idea or objection that caused—or failed to
      cause—that movement, give your strongest reason now, and state the most
      serious objection or uncertainty that remains.
    guidance: >-
      Movement is not automatically improvement. An unchanged judgment is
      equally defensible when you explain why the chapter's strongest pressure
      did not dislodge it.
    responseStructure: movement-plus-prose
    rationale: >-
      The student has encountered the framework's major objections and can now
      distinguish the fact of movement from the quality of the reasons,
      preserve the strongest current warrant, and keep a live objection open.
```

## Prompt Quality Gate

- **Disciplinary specificity:** Each checkpoint requires ethical classification, a contrast case using *phronesis*, or a metacognitive trace of a considered judgment.
- **Textual timing:** The first precedes Aristotle's vocabulary, the second follows the central practical-wisdom distinction, and the third follows the chapter's serious objections.
- **Constructive engagement:** No response can be completed by copying a chapter sentence; each requires the student to supply a warrant, altered case, or account of judgment movement.
- **Justification:** Every response requires a reason tied to a case feature, philosophical distinction, or objection.
- **Genuine openness:** Assistance, substitution, intermediate positions, and every movement category can be responsibly defended.
- **Constraint:** Each checkpoint names one principal reasoning task and a clear quality criterion.
- **Neutrality:** The language does not imply that refusing AI, accepting AI, or changing one's mind is the preferred result.
- **Cognitive economy:** Each response can be completed seriously in two to five sentences.
- **Sequence:** The set preserves a starting warrant, pressure-tests its controlling feature, and reconciles the resulting judgment under objection.
- **Privacy:** All choices and prose remain in page memory until the student explicitly downloads the record.
