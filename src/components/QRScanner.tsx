import React from 'react';
import { QrReader } from 'react-qr-reader';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (result: string) => void;
}

const QRScanner = ({ isOpen, onClose, onScan }: QRScannerProps) => {
  const handleScan = (result: any) => {
    if (result?.text) {
      onScan(result.text);
      onClose();
      toast.success("QR Code scanned successfully!");
    }
  };

  const handleError = (error: any) => {
    console.error(error);
    toast.error("Error scanning QR code");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-arcade-neonCyan">Scan QR Code to Submit Score</DialogTitle>
        </DialogHeader>
        <div className="w-full aspect-square">
          <QrReader
            constraints={{ facingMode: 'environment' }}
            onResult={handleScan}
            onError={handleError}
            className="w-full h-full"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QRScanner;