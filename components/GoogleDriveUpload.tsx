'use client';

import { useState, useRef } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

export default function GoogleDriveUpload({ onUploadSuccess }: { onUploadSuccess: (url: string) => void }) {
  const { googleToken, connectDrive } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successLink, setSuccessLink] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setSuccessLink(null);
    }
  };

  const attemptUpload = async () => {
    if (!file) return;
    
    let token = googleToken;
    if (!token) {
      token = await connectDrive();
      if (!token) {
        setError('Google Drive access is required to upload files.');
        return;
      }
    }

    setUploading(true);
    setError(null);

    try {
      // 1. Get or create the folder
      let folderId = '';
      const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='Samard Tracking' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id)`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const searchData = await searchRes.json();
      
      if (searchData.files && searchData.files.length > 0) {
        folderId = searchData.files[0].id;
      } else {
        const createFolderRes = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Samard Tracking',
            mimeType: 'application/vnd.google-apps.folder',
          }),
        });
        const folderData = await createFolderRes.json();
        folderId = folderData.id;
      }

      // 2. Upload file to folder
      const metadata = {
        name: file.name,
        mimeType: file.type,
        parents: [folderId],
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', file);

      const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      });

      if (!res.ok) {
        throw new Error('Upload failed. The token might have expired.');
      }

      const data = await res.json();
      setSuccessLink(data.webViewLink);
      onUploadSuccess(data.webViewLink);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'An error occurred while uploading.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mt-4">
      <label className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider mb-2 block">Attachment (Optional)</label>
      
      {successLink ? (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={24} className="text-emerald-500" />
            <div>
              <div className="text-sm text-emerald-500 font-bold text-ellipsis overflow-hidden max-w-[200px] whitespace-nowrap">{file?.name}</div>
              <div className="text-xs text-emerald-500/70">Saved to Google Drive</div>
            </div>
          </div>
          <button onClick={() => { setFile(null); setSuccessLink(null); }} className="text-xs font-bold text-emerald-500 hover:text-emerald-400">Change</button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            accept="image/*,application/pdf"
          />
          <div className="flex gap-2">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 border border-dashed border-zinc-300 dark:border-white/20 hover:border-white/40 bg-zinc-100 dark:bg-white/5 rounded-xl py-3 px-4 flex items-center justify-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 transition-colors"
            >
              <UploadCloud size={18} />
              {file ? file.name : 'Select file'}
            </button>
            {file && (
              <button 
                onClick={attemptUpload}
                disabled={uploading}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold px-4 rounded-xl flex items-center justify-center transition-colors"
              >
                {uploading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : 'Upload'}
              </button>
            )}
          </div>
          {error && (
            <div className="flex items-center gap-2 text-rose-500 text-xs mt-1 bg-rose-500/10 p-2 rounded-lg">
              <AlertCircle size={14} /> {error}
            </div>
          )}
          {!googleToken && file && !uploading && !error && (
             <div className="text-xs text-indigo-400">You will be prompted to grant Google Drive access.</div>
          )}
        </div>
      )}
    </div>
  );
}
