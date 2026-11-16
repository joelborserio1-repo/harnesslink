import { useEffect, useRef, useState } from 'react';
import { Box, Button, Flex, TextInput, Typography } from '@strapi/design-system';
import { useFetchClient, useForm, useNotification } from '@strapi/strapi/admin';

// "Lead photo" at the top of a story's side panel: the story's main photo,
// large, with its caption, so the editor sees at a glance what readers will
// see on the story card and at the top of the story. Change it by uploading a
// new one here or from the Photos panel below (archive search), or remove it.
//
// An uploaded photo (featuredImage) wins over one from the archive
// (legacyImage), as on the site.

type Media = { id: number; url: string; alternativeText?: string | null; caption?: string | null; formats?: Record<string, { url: string }> | null };
type Legacy = { id?: number; url: string; alt?: string | null; caption?: string | null; width?: number | null; height?: number | null; credit?: string | null; legacyWpId?: number | null };

const absolute = (url: string) => (/^https?:\/\//.test(url) ? url : `${(window as any).strapi?.backendURL || window.location.origin}${url}`);

// The archive search box in the Photos panel, if it's on the page.
function focusArchiveSearch() {
  const input = Array.from(document.querySelectorAll('input')).find((el) =>
    /search|horse|driver/i.test(el.getAttribute('placeholder') || el.getAttribute('aria-label') || '')
  ) as HTMLInputElement | undefined;
  if (input) {
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    input.focus();
    return true;
  }
  return false;
}

function LeadPhoto() {
  const { post } = useFetchClient();
  const { toggleNotification } = useNotification();
  const featured = useForm('LeadPhotoPanel', (s: any) => s.values.featuredImage) as Media | null;
  const legacy = useForm('LeadPhotoPanel', (s: any) => s.values.legacyImage) as Legacy | null;
  const onChange = useForm('LeadPhotoPanel', (s: any) => s.onChange) as (name: string, value: unknown) => void;
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [savingCaption, setSavingCaption] = useState(false);

  const source: 'upload' | 'archive' | null = featured?.url ? 'upload' : legacy?.url ? 'archive' : null;
  const src = featured?.url
    ? absolute(featured.formats?.large?.url || featured.formats?.medium?.url || featured.url)
    : legacy?.url || '';
  const savedCaption = (source === 'upload' ? featured?.caption : legacy?.caption) || '';
  const [caption, setCaption] = useState(savedCaption);
  useEffect(() => setCaption(savedCaption), [savedCaption, src]);

  const note = (type: 'success' | 'danger', message: string) => toggleNotification({ type, message });

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('files', file);
      form.append('fileInfo', JSON.stringify({ name: file.name, caption: caption || null, alternativeText: caption || null }));
      const { data } = await post<Media[]>('/upload', form);
      onChange('featuredImage', data[0]);
      note('success', 'Lead photo set. Save the story to keep it');
    } catch {
      note('danger', 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const saveCaption = async () => {
    if (source === 'archive' && legacy) {
      onChange('legacyImage', { ...legacy, caption: caption || null, alt: legacy.alt || caption || null });
      note('success', 'Caption changed. Save the story to keep it');
      return;
    }
    if (source === 'upload' && featured) {
      setSavingCaption(true);
      try {
        const form = new FormData();
        form.append('fileInfo', JSON.stringify({ caption: caption || null, alternativeText: featured.alternativeText || caption || null }));
        const { data } = await post<Media>(`/upload?id=${featured.id}`, form);
        onChange('featuredImage', { ...featured, ...(data as any), caption: caption || null });
        note('success', 'Caption saved');
      } catch {
        note('danger', 'Could not save the caption');
      } finally {
        setSavingCaption(false);
      }
    }
  };

  const remove = () => {
    if (featured) onChange('featuredImage', null);
    if (legacy) onChange('legacyImage', null);
    note('success', 'Lead photo removed. Save the story to keep it');
  };

  const findInArchive = () => {
    if (!focusArchiveSearch()) note('danger', 'Open the Photos panel below to search the archive');
  };

  return (
    <Flex direction="column" alignItems="stretch" gap={2} width="100%">
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      {source ? (
        <>
          <a href={src} target="_blank" rel="noreferrer" title="Open full size">
            <img
              src={src}
              alt={(source === 'upload' ? featured?.alternativeText : legacy?.alt) || ''}
              style={{ display: 'block', width: '100%', aspectRatio: '3 / 2', objectFit: 'cover', background: '#eaeaef' }}
            />
          </a>
          <Typography variant="pi" textColor="neutral600">
            {source === 'upload' ? 'Uploaded photo' : 'From the photo archive'}
          </Typography>
          <TextInput
            aria-label="Lead photo caption"
            placeholder="Caption: who, where, photo credit"
            value={caption}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCaption(e.target.value)}
            size="S"
          />
          {caption !== savedCaption && (
            <Button variant="secondary" size="S" loading={savingCaption} onClick={saveCaption}>
              Save caption
            </Button>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
            <Button variant="secondary" size="S" fullWidth loading={uploading} onClick={() => fileRef.current?.click()}>
              Upload
            </Button>
            <Button variant="secondary" size="S" fullWidth onClick={findInArchive}>
              Archive
            </Button>
            <Button variant="danger-light" size="S" fullWidth onClick={remove}>
              Remove
            </Button>
          </div>
        </>
      ) : (
        <>
          <Box
            background="neutral100"
            style={{ aspectRatio: '3 / 2', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #c0c0cf' }}
          >
            <Typography variant="omega" textColor="neutral600">
              No lead photo yet
            </Typography>
          </Box>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            <Button size="S" fullWidth loading={uploading} onClick={() => fileRef.current?.click()}>
              Upload
            </Button>
            <Button variant="secondary" size="S" fullWidth onClick={findInArchive}>
              From archive
            </Button>
          </div>
        </>
      )}
    </Flex>
  );
}

const LeadPhotoPanel = ({ model }: { model: string }) => {
  if (model !== 'api::article.article') return null;
  return { title: 'Lead photo', content: <LeadPhoto /> };
};

export default LeadPhotoPanel;
