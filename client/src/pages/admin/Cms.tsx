import { useState } from 'react';
import MediaLibrary from './cms/MediaLibrary';
import ContentEditor from './cms/ContentEditor';

type Tab = 'media' | 'content';

const tabs: { id: Tab; label: string }[] = [
  { id: 'media', label: 'Media library' },
  { id: 'content', label: 'Landing content' },
];

export default function Cms() {
  const [tab, setTab] = useState<Tab>('media');

  return (
    <div>
      <div className="mb-6 flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              tab === t.id
                ? 'bg-zinc-800 text-white ring-1 ring-brand-500/40'
                : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'media' ? <MediaLibrary /> : <ContentEditor />}
    </div>
  );
}