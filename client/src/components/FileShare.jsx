import { useState, useEffect } from 'react';
import { Upload, Download, File, ShieldAlert, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { encryptFile, decryptFile, encryptText, decryptText } from '../utils/crypto';
import API from '../utils/api';

function FileShare({ socket, roomId, username, cryptoKey }) {
  const [filesList, setFilesList] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Fetch initial files
    const fetchFiles = async () => {
      try {
        const res = await API.get(`/file/list/${roomId}`);
        const list = res.data;

        // Decrypt filenames in list
        const decryptedList = await Promise.all(
          list.map(async (file) => {
            let decryptedName = file.fileName;
            if (cryptoKey) {
              decryptedName = await decryptText(file.fileName, cryptoKey);
            }
            return { ...file, displayName: decryptedName };
          })
        );

        setFilesList(decryptedList);
      } catch (err) {
        console.error('Error fetching files:', err);
      }
    };

    fetchFiles();

    // Listen to new file shares over socket
    if (socket) {
      socket.on('file-shared', async (newFile) => {
        let decryptedName = newFile.fileName;
        if (cryptoKey) {
          decryptedName = await decryptText(newFile.fileName, cryptoKey);
        }
        setFilesList((prev) => [{ ...newFile, displayName: decryptedName }, ...prev]);
      });
    }

    return () => {
      if (socket) {
        socket.off('file-shared');
      }
    };
  }, [roomId, socket, cryptoKey]);

  // Handle file select
  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
    setErrorMsg('');
    setStatusMsg('');
  };

  // Upload file
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    setStatusMsg('Encrypting file...');
    setErrorMsg('');

    try {
      // 1. Read file as ArrayBuffer
      const fileReader = new FileReader();
      
      fileReader.onload = async (event) => {
        const arrayBuffer = event.target.result;

        try {
          // 2. Encrypt file buffer and filename
          let encryptedBuffer;
          let encryptedName = selectedFile.name;

          if (cryptoKey) {
            encryptedBuffer = await encryptFile(arrayBuffer, cryptoKey);
            encryptedName = await encryptText(selectedFile.name, cryptoKey);
          } else {
            encryptedBuffer = arrayBuffer;
          }

          // 3. Create blob from encrypted array buffer
          const encryptedBlob = new Blob([encryptedBuffer], { type: 'application/octet-stream' });

          // 4. Build FormData
          const formData = new FormData();
          formData.append('file', encryptedBlob, 'encrypted-blob');
          formData.append('roomId', roomId);
          formData.append('encryptedName', encryptedName);

          setStatusMsg('Uploading encrypted file to GridFS...');
          const res = await API.post('/file/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });

          setStatusMsg('File shared successfully!');
          setSelectedFile(null);

          // Clear file input
          const fileInput = document.getElementById('file-selector-input');
          if (fileInput) fileInput.value = '';

          // Add to local list
          const localFileObj = {
            ...res.data,
            displayName: selectedFile.name,
          };
          setFilesList((prev) => [localFileObj, ...prev]);

          // Broadcast upload to peers
          if (socket) {
            socket.emit('send-message', {
              id: `system-file-${Date.now()}`,
              sender: username,
              encryptedText: `shared a file: ${selectedFile.name}`,
              isSystem: true,
            });
            socket.emit('file-uploaded', res.data); // optional event
            socket.emit('log-file-shared', { roomId, username, fileName: selectedFile.name });
          }
        } catch (err) {
          setErrorMsg('Encryption or upload failed.');
        } finally {
          setUploading(false);
        }
      };

      fileReader.onerror = () => {
        setErrorMsg('Error reading file.');
        setUploading(false);
      };

      fileReader.readAsArrayBuffer(selectedFile);
    } catch (err) {
      setErrorMsg('Failed to process file.');
      setUploading(false);
    }
  };

  // Download and Decrypt File
  const handleDownload = async (file) => {
    setDownloadingId(file.gridFsId);
    setErrorMsg('');

    try {
      // 1. Download encrypted file
      const res = await API.get(`/file/download/${file.gridFsId}`, {
        responseType: 'arraybuffer',
      });

      // 2. Decrypt buffer
      let decryptedBuffer;
      if (cryptoKey) {
        decryptedBuffer = await decryptFile(res.data, cryptoKey);
      } else {
        decryptedBuffer = res.data;
      }

      // 3. Create blob url and trigger local download
      const decryptedBlob = new Blob([decryptedBuffer], { type: file.fileType || 'application/octet-stream' });
      const blobUrl = URL.createObjectURL(decryptedBlob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = file.displayName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setErrorMsg('Download or decryption failed. Make sure your Room Key matches.');
    } finally {
      setDownloadingId(null);
    }
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a19]/90 border border-white/5 rounded-2xl overflow-hidden relative font-sans">
      
      {/* File security notice */}
      <div className="bg-purple-950/20 border-b border-white/5 py-3 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-purple-300 font-display">
          <ShieldAlert size={14} className="text-purple-400" />
          <span>E2EE File sharing storage</span>
        </div>
      </div>

      {/* Upload Form Box */}
      <form onSubmit={handleUpload} className="p-4 bg-white/5 border-b border-white/5 flex flex-col gap-3">
        <div className="flex flex-col items-center justify-center p-4 border border-dashed border-white/10 rounded-xl bg-black/40 hover:bg-black/50 transition relative">
          <input
            id="file-selector-input"
            type="file"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <Upload className="text-purple-400 mb-2" size={24} />
          <span className="text-xs text-gray-300 font-medium">
            {selectedFile ? selectedFile.name : 'Click or Drag files to select'}
          </span>
          <span className="text-[10px] text-gray-500 mt-1">
            {selectedFile ? formatSize(selectedFile.size) : 'Any size (GridFS supported)'}
          </span>
        </div>

        {/* Alerts status */}
        {statusMsg && (
          <div className="text-xs text-purple-400 font-medium flex items-center gap-1.5 px-1">
            <CheckCircle size={12} /> {statusMsg}
          </div>
        )}
        {errorMsg && (
          <div className="text-xs text-red-400 font-medium flex items-center gap-1.5 px-1">
            <AlertCircle size={12} /> {errorMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={!selectedFile || uploading}
          className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold font-display shadow-md shadow-purple-500/25 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <>
              <Loader className="animate-spin" size={16} />
              <span>Processing...</span>
            </>
          ) : (
            <>
              <Upload size={16} />
              <span>Share Encrypted File</span>
            </>
          )}
        </button>
      </form>

      {/* Files Shared History List */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 no-scrollbar">
        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-display">Shared Files</h4>

        {filesList.length === 0 ? (
          <div className="flex-grow flex flex-col items-center justify-center text-center text-gray-500 py-10 gap-1 text-xs">
            <File size={20} className="opacity-40 mb-1" />
            <p>No files shared in this room yet.</p>
          </div>
        ) : (
          filesList.map((file) => (
            <div
              key={file._id}
              className="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-xl hover:border-purple-500/20 transition group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-lg text-purple-400">
                  <File size={16} />
                </div>
                <div className="min-w-0 flex flex-col">
                  <span className="text-xs font-semibold text-white truncate pr-2 font-display">
                    {file.displayName}
                  </span>
                  <span className="text-[9px] text-gray-400 font-sans mt-0.5">
                    {formatSize(file.fileSize)} • {file.sender}
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleDownload(file)}
                disabled={downloadingId !== null}
                className="p-2 rounded-lg bg-white/5 hover:bg-purple-600 text-gray-400 hover:text-white cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
                title="Download file"
              >
                {downloadingId === file.gridFsId ? (
                  <Loader className="animate-spin" size={14} />
                ) : (
                  <Download size={14} />
                )}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default FileShare;
