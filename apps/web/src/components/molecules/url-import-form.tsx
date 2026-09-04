'use client';

import { useState } from 'react';
import { Input } from '@/components/atoms/input';
import { Button } from '@/components/atoms/button';
import { UseUrlImport } from '@/hooks/use-url-import';

export function UrlImportForm(): JSX.Element {
  const [url, setUrl] = useState('');
  const { isImporting, error, importFromUrl } = UseUrlImport();

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    if (url.trim()) {
      importFromUrl(url.trim());
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex gap-2">
        <Input
          type="url"
          placeholder="https://www.youtube.com/watch?v=..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={isImporting}
          required
        />
        <Button type="submit" disabled={isImporting || !url.trim()}>
          {isImporting ? 'Starting...' : 'Import'}
        </Button>
      </div>
      <p className="text-xs text-gray-500">
        Only import videos you own or otherwise have the rights to clip. Downloading someone else&apos;s YouTube video may
        violate YouTube&apos;s Terms of Service.
      </p>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </form>
  );
}
