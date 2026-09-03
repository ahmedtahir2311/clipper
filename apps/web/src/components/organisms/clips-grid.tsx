import type { ClipDto } from '@clipper/shared';
import { ClipCard } from '@/components/molecules/clip-card';

export function ClipsGrid({ clips }: { clips: ClipDto[] }): JSX.Element {
  if (clips.length === 0) {
    return <p className="text-sm text-gray-500">No clips generated yet.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {clips.map((clip) => (
        <ClipCard key={clip.id} clip={clip} />
      ))}
    </div>
  );
}
