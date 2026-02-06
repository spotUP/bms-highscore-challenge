import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { getCardStyle, getTypographyStyle } from '@/utils/designSystem';
import StorageImage from '@/components/StorageImage';

const BUCKET = 'user-uploads';

const StorageTester: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [myFiles, setMyFiles] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [otherUserId, setOtherUserId] = useState('');
  const [otherList, setOtherList] = useState<any[] | null>(null);
  const [otherError, setOtherError] = useState<string | null>(null);

  const myFolder = useMemo(() => (user?.id ? `${user.id}` : ''), [user?.id]);

  const loadMyFiles = useCallback(async () => {
    if (!myFolder) return;
    setLoadingList(true);
    try {
      const { data, error } = await api.storage.from(BUCKET).list(myFolder, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (error) throw error;
      const files = data || [];
      // Attach short-lived signed URLs for convenience (valid 300s)
      const withLinks = await Promise.all(
        files.map(async (f) => {
          try {
            const path = `${myFolder}/${f.name}`;
            const { data: signed, error: sErr } = await api.storage.from(BUCKET).createSignedUrl(path, 300);
            return { ...f, _path: path, _signedUrl: signed?.signedUrl, _signedError: sErr?.message };
          } catch (e) {
            return { ...f, _path: `${myFolder}/${f.name}`, _signedUrl: null, _signedError: String(e) };
          }
        })
      );
      setMyFiles(withLinks);
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to list your files', variant: 'destructive' });
    } finally {
      setLoadingList(false);
    }
  }, [myFolder, toast]);

  useEffect(() => {
    loadMyFiles();
  }, [loadMyFiles]);

  const onUpload = async (evt: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const files = evt.target.files;
      if (!files || files.length === 0) return;
      if (!myFolder) {
        toast({ title: 'Not signed in', description: 'Please sign in to upload.', variant: 'destructive' });
        return;
      }
      setUploading(true);
      const file = files[0];
      const ext = file.name.split('.').pop();
      const path = `${myFolder}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext ? '.' + ext : ''}`;
      const { error } = await api.storage.from(BUCKET).upload(path, file, {
        upsert: false,
        contentType: file.type || undefined,
      });
      if (error) throw error;
      // Provide a short-lived signed URL for quick testing
      try {
        const { data: signed } = await api.storage.from(BUCKET).createSignedUrl(path, 300);
        if (signed?.signedUrl) {
          try { await navigator.clipboard.writeText(signed.signedUrl); } catch {}
          toast({ title: 'Uploaded', description: `Saved as ${path}. Signed URL (5 min) copied to clipboard.` });
        } else {
          toast({ title: 'Uploaded', description: `Saved as ${path}` });
        }
      } catch {
        toast({ title: 'Uploaded', description: `Saved as ${path}` });
      }
      // Verify by downloading immediately (proves the object exists and is readable via SDK)
      try {
        const { data: blob, error: dlErr } = await api.storage.from(BUCKET).download(path);
        if (dlErr) throw dlErr;
        const size = (blob as Blob)?.size;
        toast({ title: 'Verified', description: `Downloaded ${size ?? 0} bytes via SDK.` });
      } catch (verifyErr: any) {
        toast({ title: 'Verification failed', description: verifyErr?.message || 'Could not download after upload', variant: 'destructive' });
      }
      await loadMyFiles();
      (evt.target as HTMLInputElement).value = '';
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err?.message || 'Unable to upload file', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const tryListOther = async () => {
    setOtherList(null);
    setOtherError(null);
    const folder = (otherUserId || '').trim();
    if (!folder) {
      toast({ title: 'Input required', description: 'Enter a user ID (UUID) to test access.', variant: 'destructive' });
      return;
    }
    try {
      const { data, error } = await api.storage.from(BUCKET).list(folder, { limit: 10 });
      if (error) throw error;
      setOtherList(data || []);
      if ((data || []).length === 0) {
        toast({ title: 'Access test', description: 'No files listed for other user (expected or they have no files).', variant: 'default' });
      } else {
        toast({ title: 'Access test', description: `Listed ${data.length} items for other user (unexpected if their files exist and RLS is strict).`, variant: 'destructive' });
      }
    } catch (err: any) {
      setOtherError(err?.message || String(err));
      toast({ title: 'Access blocked', description: 'Could not list other user folder (expected)', variant: 'default' });
    }
  };

  return (
    <Card className={getCardStyle('primary')}>
      <CardHeader>
        <CardTitle className={getTypographyStyle('h3')}>Storage Tester</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div>
            <Label>Your User ID</Label>
            <div className="mt-1 text-sm text-gray-300 break-all">{user?.id || 'Not signed in'}</div>
          </div>

          <div className="grid gap-2 md:grid-cols-[1fr_auto] items-end">
            <div>
              <Label>Upload a file to your folder</Label>
              <Input type="file" accept="image/*,application/pdf" onChange={onUpload} disabled={uploading || !user} />
            </div>
            <div>
              <Button onClick={loadMyFiles} variant="outline" disabled={loadingList}>Refresh My Files</Button>
            </div>
          </div>

          <div>
            <Label>My Files ({myFiles.length})</Label>
            <div className="mt-2 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Preview</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Updated At</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myFiles.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-gray-400 italic">No files found</TableCell></TableRow>
                  )}
                  {myFiles.map((f) => (
                    <TableRow key={f.id || f.name}>
                      <TableCell>
                        <div className="w-16 h-16 rounded overflow-hidden bg-black/30 border border-white/10 flex items-center justify-center">
                          <StorageImage
                            bucket={BUCKET}
                            path={`${myFolder}/${f.name}`}
                            alt={f.name}
                            width={64}
                            height={64}
                            style={{ objectFit: 'cover' }}
                            expiresIn={300}
                          />
                        </div>
                      </TableCell>
                      <TableCell>{f.name}</TableCell>
                      <TableCell>{f.updated_at ? new Date(f.updated_at).toLocaleString() : '-'}</TableCell>
                      <TableCell>{typeof f.metadata?.size === 'number' ? `${f.metadata.size} B` : '-'}</TableCell>
                      <TableCell className="space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              const { data, error } = await api.storage.from(BUCKET).createSignedUrl(f._path || `${myFolder}/${f.name}`, 300);
                              if (error) throw error;
                              if (data?.signedUrl) {
                                try { await navigator.clipboard.writeText(data.signedUrl); } catch {}
                                toast({ title: 'Signed URL', description: 'Copied to clipboard (valid 5 min).' });
                              }
                            } catch (e: any) {
                              toast({ title: 'Error', description: e?.message || 'Failed to create signed URL', variant: 'destructive' });
                            }
                          }}
                        >Copy Link</Button>
                        {f._signedUrl && (
                          <a href={f._signedUrl} target="_blank" rel="noreferrer" className="inline-block">
                            <Button variant="outline" size="sm">Open</Button>
                          </a>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              const path = f._path || `${myFolder}/${f.name}`;
                              const { data, error } = await api.storage.from(BUCKET).download(path);
                              if (error) throw error;
                              const blob = data as Blob;
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = f.name || 'download';
                              document.body.appendChild(a);
                              a.click();
                              a.remove();
                              URL.revokeObjectURL(url);
                            } catch (e: any) {
                              toast({ title: 'Download failed', description: e?.message || 'Unable to download file', variant: 'destructive' });
                            }
                          }}
                        >Download</Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              const path = f._path || `${myFolder}/${f.name}`;
                              const { error } = await api.storage.from(BUCKET).remove([path]);
                              if (error) throw error;
                              toast({ title: 'Deleted', description: f.name });
                              await loadMyFiles();
                            } catch (e: any) {
                              toast({ title: 'Delete failed', description: e?.message || 'Unable to delete file', variant: 'destructive' });
                            }
                          }}
                        >Delete</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-[1fr_auto] items-end">
            <div>
              <Label>Test access to another user's folder (enter user ID)</Label>
              <Input placeholder="00000000-0000-0000-0000-000000000000" value={otherUserId} onChange={(e) => setOtherUserId(e.target.value)} />
            </div>
            <div>
              <Button variant="outline" onClick={tryListOther}>Try List</Button>
            </div>
          </div>

          {otherError && (
            <div className="text-sm text-yellow-400">Access blocked as expected: {otherError}</div>
          )}
          {otherList && (
            <div className="text-sm text-red-400">Was able to list {otherList.length} item(s) for other user. Review policies if this is unexpected.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default StorageTester;
