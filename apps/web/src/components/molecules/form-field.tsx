import { Label } from '@/components/atoms/label';
import { Input } from '@/components/atoms/input';

interface FormFieldProps {
  label: string;
  name: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
}

export function FormField({ label, name, type = 'text', value, onChange, error, required }: FormFieldProps): JSX.Element {
  return (
    <div className="space-y-1">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} />
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
