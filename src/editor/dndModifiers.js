// Same as @dnd-kit/modifiers' restrictToVerticalAxis — inlined to skip a dependency for one line.
export const restrictToVerticalAxis = ({ transform }) => ({ ...transform, x: 0 });
