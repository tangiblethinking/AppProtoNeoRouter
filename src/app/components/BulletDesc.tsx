import { useEditContext, EditableText } from './EditableText';

interface BulletDescProps {
  editKey: string;
  value: string;
}

/**
 * Renders a `*`-delimited string as a bulleted list.
 * In edit mode, falls back to a single EditableText span.
 */
export function BulletDesc({ editKey, value }: BulletDescProps) {
  const { editable, edits, overrides } = useEditContext();

  // In edit mode, render the raw editable text
  if (editable) {
    return <EditableText editKey={editKey} value={value} />;
  }

  // Resolve through the same chain: edits → overrides → hardcoded
  const resolved = edits[editKey]?.to ?? overrides[editKey] ?? value;

  // Split on `*`, trim, and filter empty
  const bullets = resolved
    .split('*')
    .map((s) => s.trim())
    .filter(Boolean);

  if (bullets.length <= 1) {
    // No bullets found — render as plain text
    return <span>{resolved}</span>;
  }

  return (
    <ul className="timeline-bullets">
      {bullets.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
