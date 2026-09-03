import { cn } from '@/lib/utils';

type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

export function Label({ className, ...props }: LabelProps): JSX.Element {
  return <label className={cn('mb-1 block text-sm font-medium text-gray-700', className)} {...props} />;
}
