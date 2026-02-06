import React, { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Upload, X } from "lucide-react";

interface ImagePasteUploadProps {
  value: string;
  onChange: (url: string) => void;
  label: string;
  placeholder: string;
}

const ImagePasteUpload = ({ value, onChange, label, placeholder }: ImagePasteUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Global paste event listener
  useEffect(() => {
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items || []);
      const imageItem = items.find(item => item.type.startsWith('image/'));
      
      if (imageItem) {
        e.preventDefault();
        e.stopPropagation();
        const file = imageItem.getAsFile();
        if (file) {
          await uploadImage(file);
        }
      }
    };

    document.addEventListener('paste', handleGlobalPaste);
    return () => document.removeEventListener('paste', handleGlobalPaste);
  }, []);

  const uploadImage = async (file: File) => {
    setIsUploading(true);
    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      
      // Upload to storage
      const { data, error } = await api.storage
        .from('game-logos')
        .upload(fileName, file);

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = api.storage
        .from('game-logos')
        .getPublicUrl(fileName);

      onChange(publicUrl);
      
      toast({
        title: "Success",
        description: "Image uploaded successfully"
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "Error",
        description: "Failed to upload image",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find(item => item.type.startsWith('image/'));
    
    if (imageItem) {
      const file = imageItem.getAsFile();
      if (file) {
        await uploadImage(file);
      }
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        await uploadImage(file);
      } else {
        toast({
          title: "Error",
          description: "Please upload an image file",
          variant: "destructive"
        });
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadImage(e.target.files[0]);
    }
  };

  const clearImage = () => {
    onChange("");
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="space-y-2">
        <div className="relative">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="bg-black/50 border-white/20 text-white w-full min-w-0"
          />
        </div>
        
        {value && (
          <div className="flex items-center gap-2 p-2 bg-black/30 rounded border border-white/20 w-full min-w-0">
            <img 
              src={value} 
              alt="Logo preview" 
              className="w-12 h-12 object-contain bg-white/10 rounded flex-shrink-0"
            />
            <span className="text-sm text-gray-300 flex-1 truncate min-w-0 max-w-[200px] overflow-hidden">{value}</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={clearImage}
              className="text-red-400 hover:text-red-300"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        <div
          className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
            dragActive 
              ? 'border-arcade-neonCyan bg-arcade-neonCyan/10' 
              : 'border-white/20 hover:border-white/40'
          }`}
          tabIndex={0}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onPaste={handlePaste}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          role="button"
          aria-label="Upload area - click, drag and drop, or paste an image"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div className="space-y-2">
            <Upload className="w-8 h-8 mx-auto text-gray-400" />
            <div className="text-sm text-gray-300">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="text-arcade-neonCyan hover:text-arcade-neonCyan/80"
              >
                Click to upload
              </Button>
              {' or drag and drop an image'}
            </div>
            <div className="text-xs text-gray-400">
              You can also paste an image anywhere in this dialog (Ctrl+V)
            </div>
          </div>
          
          {isUploading && (
            <div className="mt-2 text-arcade-neonCyan">Uploading...</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImagePasteUpload;