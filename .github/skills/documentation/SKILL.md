---
name: documentation
description: How to write and update clear, maintainable project documentation. Use when adding or changing documentation, guides, READMEs, or reusable agent instructions.
---

# Writing project documentation

## Start from the reader's task
- Identify who will use the documentation and what they need to accomplish.
- Lead with the practical answer: the current convention, workflow, or decision the reader needs.
- Explain necessary context before details that depend on it.

## Make guidance actionable
- Describe the preferred approach and how to apply it.
- Use the project's actual terminology, paths, commands, and examples.
- Keep instructions specific enough to follow, but general enough to remain useful across future changes.
- Explain constraints or edge cases when they affect the reader's choices.

## Keep it current and focused
- Check relevant source code, configuration, and existing documentation before writing.
- Match documented behavior to the implementation; distinguish current behavior from intended or planned behavior.
- Update directly related documentation when changing the behavior it describes.
- Remove stale, redundant, or unrelated material rather than layering new text over it.
- Keep known gaps when they affect implementation decisions, and state their practical impact.

## Prefer direct, positive wording
- State what to do, such as “Store technology IDs in `requiredTech` arrays.”
- Avoid documenting rejected or obsolete approaches unless a reader is likely to encounter them and the warning prevents a real mistake.
- Avoid instructions that only make sense as commentary on the history of a change.
- Use warnings sparingly and include the reason or consequence.
- Prefer concise language; avoid redundant emphasis and repeated explanations.

## Structure for scanning
- Use a descriptive title and headings that reflect the reader's questions or workflow.
- Put essential conventions and steps before background details.
- Use lists for procedures and tables for compact comparisons or terminology.
- Include examples when they make an instruction easier to apply; ensure examples follow the current project conventions.
- Link to authoritative project files or sections when readers need deeper detail.

## Validate documentation changes
- Check names, paths, commands, and examples against the repository.
- Ensure instructions do not conflict with other project guidance.
- For documentation-only changes, run documentation checks only if the project provides them.
