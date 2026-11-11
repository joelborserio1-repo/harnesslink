import { useRef, useState } from 'react';
import { Box, Button, Flex, TextInput, Typography } from '@strapi/design-system';
import { useFetchClient, useForm, useNotification } from '@strapi/strapi/admin';
import { PhotoSearch, type Photo } from './PhotoArchive';

// "Photos" in a story's side panel: find a photo in the archive (every photo
// from the old site, src/photos.ts) or upload a new one, then make it the lead
// photo or put it in the story where the cursor is — without leaving the story.

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function figure(p: { url: string; alt: string; caption: string; width?: number | null; height?: number | null }) {
  const size = p.width && p.height ? ` width="${p.width}" height="${p.height}"` : '';
  const cap = p.caption ? `<figcaption>${esc(p.caption)}</figcaption>` : '';
  return `<figure class="image"><img src="${esc(p.url)}" alt="${esc(p.alt)}"${size}>${cap}</figure>`;
}

// The story's CKEditor (CKEditor 5 hangs the editor off its editable element).
function storyEditor(): any {
  for (const el of Array.from(document.querySelectorAll('.ck-editor__editable')) as any[]) if (el.ckeditorInstance) return el.ckeditorInstance;
  return null;
}

type Uploaded = { id: number; url: string; width?: number; height?: number; alternativeText?: string; caption?: string };

function Photos() {
  const { get, post } = useFetchClient();
  const { toggleNotification } = useNotification();
  const values = useForm('PhotosPanel', (s: any) => s.values) as Record<string, any>;
  const onChange = useForm('PhotosPanel', (s: any) => s.onChange) as (name: string, value: unknown) => void;
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<Uploaded | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const ok = (message: string) => toggleNotification({ type: 'success', message });

  const insert = (p: Parameters<typeof figure>[0]) => {
    const html = figure(p);
    const editor = storyEditor();
    if (editor) {
      const fragment = editor.data.toModel(editor.data.processor.toView(html));
      editor.model.insertContent(fragment);
      editor.editing.view.focus();
      ok('Photo added to the story at your cursor');
    } else {
      onChange('bodyHtml', `${values.bodyHtml || ''}${html}`);
      ok('Photo added to the end of the story');
    }
  };

  const leadFromArchive = async (p: Photo) => {
    // A photo uploaded in the newsroom is a media-library file: use it as is.
    if (p.fileId) {
      try {
        const { data } = await get<Uploaded>(`/upload/files/${p.fileId}`);
        onChange('featuredImage', data);
        ok('Lead photo set — save the story to keep it');
      } catch {
        toggleNotification({ type: 'danger', message: 'Could not load that photo' });
      }
      return;
    }
    onChange('legacyImage', {
      ...(values.legacyImage?.id ? { id: values.legacyImage.id } : {}),
      url: p.url,
      width: p.width,
      height: p.height,
      alt: p.alt || p.caption || p.title,
      caption: p.caption || null,
      credit: null,
      legacyWpId: p.id,
    });
    // An uploaded lead photo would take precedence on the site.
    if (values.featuredImage) onChange('featuredImage', null);
    ok('Lead photo set — save the story to keep it');
  };

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('files', file);
      form.append('fileInfo', JSON.stringify({ name: file.name, alternativeText: caption || null, caption: caption || null }));
      const { data } = await post<Uploaded[]>('/upload', form);
      setUploaded(data[0]);
    } catch {
      toggleNotification({ type: 'danger', message: 'Upload failed' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const absolute = (url: string) => (url.startsWith('http') ? url : `${(window as any).strapi?.backendURL || window.location.origin}${url}`);

  return (
    <Flex direction="column" alignItems="stretch" gap={3} width="100%">
      <Box>
        <Typography variant="sigma" textColor="neutral600">
          Upload a new photo
        </Typography>
        <Flex direction="column" alignItems="stretch" gap={2} paddingTop={1}>
          <TextInput aria-label="Caption" placeholder="Caption (who, where, photo credit)" value={caption} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCaption(e.target.value)} size="S" />
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <Button variant="secondary" loading={uploading} onClick={() => fileRef.current?.click()}>
            Choose photo…
          </Button>
          {uploaded && (
            <Flex direction="column" alignItems="stretch" gap={2}>
              <img src={absolute(uploaded.url)} alt="" style={{ maxWidth: '100%', display: 'block' }} />
              <Button
                onClick={() => {
                  onChange('featuredImage', uploaded);
                  ok('Lead photo set — save the story to keep it');
                }}
              >
                Make lead photo
              </Button>
              <Button
                variant="secondary"
                onClick={() => insert({ url: absolute(uploaded.url), alt: uploaded.alternativeText || caption, caption: uploaded.caption || caption, width: uploaded.width, height: uploaded.height })}
              >
                Insert in story
              </Button>
            </Flex>
          )}
        </Flex>
      </Box>

      <Box>
        <Typography variant="sigma" textColor="neutral600">
          Or find one in the archive
        </Typography>
        <Box paddingTop={1}>
          <PhotoSearch
            compact
            actions={(p) => (
              <>
                <Button onClick={() => leadFromArchive(p)}>Make lead photo</Button>
                <Button variant="secondary" onClick={() => insert({ url: p.url, alt: p.alt || p.caption || p.title, caption: p.caption, width: p.width, height: p.height })}>
                  Insert in story
                </Button>
              </>
            )}
          />
        </Box>
      </Box>
    </Flex>
  );
}

const PhotosPanel = ({ model }: { model: string }) => {
  if (model !== 'api::article.article') return null;
  return { title: 'Photos', content: <Photos /> };
};

export default PhotosPanel;
