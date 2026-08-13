import React, { useRef } from 'react';
import { Plus, Loader2 } from 'lucide-react';

export const UploadPdfButton = ({
  onUpload,
  isUploading = false,
  className = '',
  variant = 'primary',
  size = 'md',
  label = 'Upload PDF',
}) => {
  const fileInputRef = useRef(null);

  const handleClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
        alert('Please select a PDF file (.pdf)');
        return;
      }
      await onUpload(file);
    }
  };

  const variantStyles = {
    primary: 'bg-slate-900 hover:bg-slate-800 text-white border border-transparent shadow-xs',
    secondary: 'bg-blue-600 hover:bg-blue-700 text-white border border-transparent shadow-xs',
    outline: 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 shadow-xs',
  };

  const sizeStyles = {
    sm: 'px-2.5 py-1 text-xs font-medium space-x-1 rounded',
    md: 'px-3.5 py-1.5 text-xs font-semibold space-x-1.5 rounded-md',
    lg: 'px-4 py-2 text-sm font-semibold space-x-2 rounded-md',
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={isUploading}
        className={`inline-flex items-center justify-center transition-colors disabled:opacity-60 cursor-pointer ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      >
        {isUploading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Plus className="w-3.5 h-3.5" />
        )}
        <span>{isUploading ? 'Processing...' : label}</span>
      </button>
    </>
  );
};
