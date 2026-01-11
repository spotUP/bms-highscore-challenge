import React, { useRef, useEffect } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (result: string) => void;
}

const QRScanner = ({ isOpen, onClose, onScan }: QRScannerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReader = useRef<BrowserMultiFormatReader>();

  useEffect(() => {
    if (isOpen && videoRef.current) {
      codeReader.current = new BrowserMultiFormatReader();
      
      codeReader.current.decodeFromVideoDevice(undefined, videoRef.current, (result, error) => {
        if (result) {
          onScan(result.getText());
          onClose();
          toast.success("QR Code scanned successfully!");
        }
        if (error && error.name !== 'NotFoundException') {
          console.error(error);
          toast.error("Error scanning QR code");
        }
      });
    }

    return () => {
      if (codeReader.current) {
        codeReader.current.reset();
      }
    };
  }, [isOpen, onScan, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-arcade-neonCyan">Scan QR Code to Submit Score</DialogTitle>
        </DialogHeader>
        <div className="w-full aspect-square">
          <video
            ref={videoRef}
            className="w-full h-full object-cover rounded"
            autoPlay
            playsInline
            muted
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QRScanner;